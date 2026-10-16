import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-catalog-http-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
let childOutput = '';

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
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before becoming healthy (exit ' + child.exitCode + ')\n' + childOutput);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + (lastError?.message || 'unknown error') + '\n' + childOutput);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('service-catalog-http-' + Date.now(), 'Service Catalog HTTP Test');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Service Catalog HTTP Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({
    userId: user.id,
    chatId: tenant.chatId,
    deviceName: 'Service Catalog HTTP regression',
  });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SELLIFY_DATA_DIR: tempDir,
      SELLIFY_DB_PATH: dbPath,
      NODE_ENV: 'test',
      SERVE_STATIC: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { childOutput += chunk.toString(); });
  await waitForHealth(baseUrl);

  const authHeaders = {
    Authorization: 'Bearer ' + session.token,
    'Content-Type': 'application/json',
  };
  const products = [
    { id: 'consultation-http', name: 'Consultation', price: 25000, currency: 'ETB', item_type: 'service' },
    { id: 'soap-http', name: 'Soap', price: 5000, currency: 'ETB', stock: 8, item_type: 'product' },
  ];

  const writeResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId), {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ products }),
  });
  assert.equal(writeResponse.status, 200, 'authenticated catalog write should succeed');
  const writeBody = await writeResponse.json();
  assert.equal(writeBody.products.find(item => item.id === 'consultation-http')?.item_type, 'service');
  assert.equal(writeBody.products.find(item => item.id === 'soap-http')?.item_type, 'product');

  // The storefront read path must expose the persisted item type, not merely
  // echo the submitted request payload.
  const readResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId));
  assert.equal(readResponse.status, 200);
  const readBody = await readResponse.json();
  assert.equal(readBody.products.find(item => item.id === 'consultation-http')?.item_type, 'service');
  assert.equal(readBody.products.find(item => item.id === 'soap-http')?.item_type, 'product');

  const order = {
    id: 'service-http-order-1',
    currency: 'ETB',
    customer_name: 'HTTP Journey Buyer',
    items: [
      { id: 'consultation-http', name: 'Consultation', price: 25000, qty: 1, currency: 'ETB', item_type: 'service' },
    ],
  };
  const syncUrl = baseUrl + '/sync/' + encodeURIComponent(tenant.chatId);
  const submitOrder = () => fetch(syncUrl, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ orders: [order] }),
  });
  const firstResponse = await submitOrder();
  assert.equal(firstResponse.status, 200, 'authenticated order sync should succeed');
  const firstBody = await firstResponse.json();
  assert.equal(firstBody.results.length, 1);
  assert.equal(firstBody.results[0].status, 'synced');
  assert.ok(firstBody.results[0].order_id, 'sync should return canonical order identity');
  assert.ok(firstBody.results[0].payment_id, 'sync should return canonical payment identity');

  const retryResponse = await submitOrder();
  assert.equal(retryResponse.status, 200);
  const retryBody = await retryResponse.json();
  assert.equal(retryBody.results[0].status, 'synced');
  assert.equal(retryBody.results[0].order_id, firstBody.results[0].order_id,
    'exact retry must resolve to the same canonical order');
  assert.equal(retryBody.results[0].payment_id, firstBody.results[0].payment_id,
    'exact retry must resolve to the same canonical payment');

  const alteredOrder = { ...order, items: [{ id: 'consultation-http', name: 'Consultation', price: 25000, qty: 2, currency: 'ETB', item_type: 'service' }] };
  const alteredResponse = await fetch(syncUrl, { method: 'POST', headers: authHeaders, body: JSON.stringify({ orders: [alteredOrder] }) });
  assert.equal(alteredResponse.status, 200);
  const alteredBody = await alteredResponse.json();
  assert.equal(alteredBody.results[0].status, 'rejected');
  assert.equal(alteredBody.results[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const canonicalOrders = await store.getOrders(tenant.chatId);
  assert.equal(canonicalOrders.filter(item => item.id === order.id).length, 1,
    'HTTP retries must not create duplicate canonical orders');
  const canonicalPayments = await store.listPayments(tenant.chatId);
  assert.equal(canonicalPayments.filter(item => item.id === firstBody.results[0].payment_id).length, 1,
    'HTTP retries must not create duplicate canonical payments');

  console.log('PASS: service catalog HTTP write/readback and idempotent order sync');
} catch (error) {
  console.error(error);
  if (childOutput) console.error('Backend output:\n' + childOutput);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(tempDir, { recursive: true, force: true });
}
