import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Exercise the actual PWA catalog/order clients against the HTTP server and
// isolated SQLite database. FUX-59 covers backend fulfillment; this regression
// closes the client -> authenticated HTTP -> canonical persistence boundary.
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-first-sale-http-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalGetComputedStyle = globalThis.getComputedStyle;
const localValues = new Map();
const noop = () => {};
const fakeElement = {
  style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  setAttribute: noop, getAttribute: () => null, appendChild: noop,
  addEventListener: noop, removeEventListener: noop, dataset: {}, children: [],
  options: [], value: '',
};

globalThis.localStorage = {
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(key, String(value)); },
  removeItem(key) { localValues.delete(key); },
  clear() { localValues.clear(); },
};
globalThis.document = new Proxy({
  documentElement: fakeElement, head: fakeElement, body: fakeElement,
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: id => ['brandName', 'statusPill', 'statusText', 'queueBadge'].includes(id) ? fakeElement : null,
  createElement: () => ({ ...fakeElement, style: { ...fakeElement.style }, classList: { ...fakeElement.classList } }),
}, { get(target, key) { return key in target ? target[key] : noop; } });
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl) {
  let lastError = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before health check (exit ' + child.exitCode + ')');
    }
    try {
      const response = await originalFetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + (lastError?.message || 'unknown error'));
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('fux60-' + randomUUID(), 'FUX-60 Merchant');
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'FUX-60 First Sale', businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({
    userId: user.id, chatId: tenant.chatId, deviceName: 'FUX-60 integration device',
  });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(port), SELLIFY_DATA_DIR: tempDir,
      SELLIFY_DB_PATH: dbPath, NODE_ENV: 'test', SERVE_STATIC: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childOutput = '';
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  globalThis.window = {
    location: { origin: baseUrl },
    matchMedia: () => ({ addEventListener: noop }),
    addEventListener: noop, removeEventListener: noop,
    navigator: { onLine: true },
  };

  const state = await import('../app/src/state.js');
  state.setConfig({
    chatId: tenant.chatId, sessionToken: session.token, syncUrl: baseUrl,
    lang: 'en', currencyCode: 'ETB',
  });
  const { syncCatalog } = await import('../app/src/sync/catalog.js');
  const { syncOrders } = await import('../app/src/sync/orders.js');

  // Merchant adds a physical product and a service in the existing catalog.
  state.setProducts([
    { id: 'fux60-physical', name: 'Coffee beans', price: 120, stock: 5, type: 'product' },
    { id: 'fux60-service', name: 'Barista training', price: 900, type: 'service' },
  ]);
  await syncCatalog();
  const persistedCatalog = await store.getCatalog(tenant.chatId);
  assert.equal(persistedCatalog.products.find(item => item.id === 'fux60-physical')?.type, 'product');
  assert.equal(persistedCatalog.products.find(item => item.id === 'fux60-service')?.type, 'service');

  // First sale uses the same local queued-order shape as checkout. The real PWA
  // client posts it with the tenant session and consumes the server acknowledgement.
  const localId = 'fux60-local-' + randomUUID();
  state.setOrders([{
    id: localId, status: 'queued', currency: 'ETB', customer_name: 'First Sale Buyer',
    items: [
      { id: 'fux60-physical', name: 'Coffee beans', qty: 2, price: 120, type: 'service' },
      { id: 'fux60-service', name: 'Barista training', qty: 1, price: 900, type: 'product' },
    ],
    fulfillment_type: 'delivery', delivery_address: 'Addis Ababa',
    created_at: Date.now(),
  }]);
  await syncOrders();

  const localSynced = state.orders.find(order => order.id === localId);
  assert.equal(localSynced?.status, 'synced', 'PWA queue consumes the HTTP sync acknowledgement');
  assert.ok(localSynced?.server_order_id, 'PWA stores canonical server order identity');
  const persistedOrders = await store.getOrders(tenant.chatId);
  const persistedOrder = persistedOrders.find(order => order.server_order_id === localSynced.server_order_id);
  assert.ok(persistedOrder, 'the HTTP-submitted order is persisted in canonical SQLite storage');
  assert.equal(persistedOrder.items.length, 2);
  assert.equal(persistedOrder.total, 1140);

  // Seller writes must fail closed without the tenant-scoped session.
  const unauthorized = await originalFetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [{ id: 'fux60-forged', name: 'Forged', price: 1 }] }),
  });
  assert.equal(unauthorized.status, 401, 'catalog write is not available to an unauthenticated client');
  assert.equal((await store.getCatalog(tenant.chatId)).products.some(item => item.id === 'fux60-forged'), false);

  console.log('FUX-60 PWA -> authenticated HTTP -> SQLite first-sale integration: PASS');
  console.log('Catalog client sync and physical/service identity persistence: PASS');
  console.log('Order client sync, canonical server ID, and mixed order persistence: PASS');
  console.log('Unauthenticated catalog mutation rejected without persistence: PASS');
} catch (error) {
  if (child) {
    try { child.kill('SIGTERM'); } catch {}
  }
  throw error;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 1500);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalLocalStorage;
  globalThis.document = originalDocument;
  globalThis.getComputedStyle = originalGetComputedStyle;
  await rm(tempDir, { recursive: true, force: true });
}
