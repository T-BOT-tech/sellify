import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
    { id: 'consultation-http', name: 'Consultation', price: 25000, currency: 'ETB', item_type: 'service', marketplace_listed: true },
    { id: 'soap-http', name: 'Soap', price: 5000, currency: 'ETB', stock: 8, item_type: 'product', marketplace_listed: true },
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

  // Marketplace response-loss recovery: the first request commits, but the
  // caller deliberately discards its response. An exact retry with the same
  // idempotency key must replay the same canonical marketplace order.
  const marketplaceRequest = {
    buyer_id: 'service-marketplace-buyer-http',
    customer_name: 'Marketplace Recovery Buyer',
    items: [{ seller_id: tenant.chatId, item_id: 'consultation-http', qty: 1 }],
  };
  const marketplaceHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'service-marketplace-lost-response-http-1',
  };
  const checkoutUrl = baseUrl + '/api/marketplace/checkout';
  const committedMarketplaceResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: marketplaceHeaders,
    body: JSON.stringify(marketplaceRequest),
  });
  assert.equal(committedMarketplaceResponse.status, 200, 'first marketplace checkout should commit');
  const committedMarketplaceBody = await committedMarketplaceResponse.json();
  assert.ok(committedMarketplaceBody.marketplace_order_id);
  // Intentionally do not deliver committedMarketplaceBody to a client handler.
  const replayResponse = await fetch(checkoutUrl, {
    method: 'POST',
    headers: marketplaceHeaders,
    body: JSON.stringify(marketplaceRequest),
  });
  assert.equal(replayResponse.status, 200, 'retry after lost response should succeed');
  const replayBody = await replayResponse.json();
  assert.equal(replayBody.marketplace_order_id, committedMarketplaceBody.marketplace_order_id,
    'marketplace checkout retry must return the same canonical marketplace order');
  assert.deepEqual(replayBody.sub_orders, committedMarketplaceBody.sub_orders,
    'marketplace checkout retry must replay the original seller-order identities');

  const verificationDb = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const marketplaceOrderId = committedMarketplaceBody.marketplace_order_id;
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_orders WHERE id = ?').get(marketplaceOrderId).n, 1);
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate canonical seller orders');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_payment_allocations WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate payment allocations');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_settlements WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 1,
      'retry must not duplicate settlement records');
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_inventory_reservations WHERE marketplace_order_id = ?').get(marketplaceOrderId).n, 0,
      'service checkout must not create physical inventory reservations');
    assert.equal(verificationDb.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE reference_type = 'marketplace_order' AND reference_id = ?").get(marketplaceOrderId).n, 0,
      'service checkout must not create physical inventory movements');
  } finally {
    verificationDb.close();
  }

  // Repeat the same committed-but-unacknowledged scenario with a physical
  // product alongside a service. The canonical stock ledger must decrement
  // once, and the service line must never create a physical movement/reservation.
  const tenantLocations = await store.listOrganizationLocations(tenant.chatId);
  let defaultLocationId = tenantLocations?.[0]?.id;
  if (!defaultLocationId) {
    const createdLocation = await store.createOrganizationLocation(tenant.chatId, {
      code: 'DEFAULT', name: 'Default Inventory Location', type: 'STORE',
    });
    defaultLocationId = createdLocation.id;
  }
  assert.ok(defaultLocationId, 'test fixture should provide the canonical default inventory location');
  await store.appendInventoryMovement(tenant.chatId, {
    productId: 'soap-http',
    locationId: String(defaultLocationId),
    quantity: 8,
    movementType: 'OPENING_BALANCE',
    referenceType: 'service-catalog-http-test',
    referenceId: 'soap-opening-stock',
    eventId: 'service-catalog-http-soap-opening-stock',
    reason: 'Seed marketplace checkout regression stock',
  });

  const mixedMarketplaceRequest = {
    buyer_id: 'mixed-marketplace-recovery-buyer-http',
    customer_name: 'Mixed Marketplace Recovery Buyer',
    items: [
      { seller_id: tenant.chatId, item_id: 'consultation-http', qty: 1 },
      { seller_id: tenant.chatId, item_id: 'soap-http', qty: 2 },
    ],
  };
  const mixedMarketplaceHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'mixed-marketplace-lost-response-http-1',
  };
  const mixedCommittedResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(mixedMarketplaceRequest),
  });
  assert.equal(mixedCommittedResponse.status, 200, 'mixed product/service checkout should commit');
  const mixedCommittedBody = await mixedCommittedResponse.json();
  assert.ok(mixedCommittedBody.marketplace_order_id);
  // Simulate loss after commit: deliberately do not pass the first response to
  // the checkout caller; retry the identical request with the same key.
  const mixedReplayResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(mixedMarketplaceRequest),
  });
  assert.equal(mixedReplayResponse.status, 200);
  const mixedReplayBody = await mixedReplayResponse.json();
  assert.equal(mixedReplayBody.marketplace_order_id, mixedCommittedBody.marketplace_order_id,
    'mixed checkout retry must replay the original canonical marketplace order');
  assert.deepEqual(mixedReplayBody.sub_orders, mixedCommittedBody.sub_orders,
    'mixed checkout retry must replay the original canonical seller-order identities');

  const alteredMarketplaceRequest = {
    ...mixedMarketplaceRequest,
    items: mixedMarketplaceRequest.items.map(item => item.item_id === 'soap-http' ? { ...item, qty: 3 } : item),
  };
  const alteredMarketplaceResponse = await fetch(checkoutUrl, {
    method: 'POST', headers: mixedMarketplaceHeaders, body: JSON.stringify(alteredMarketplaceRequest),
  });
  assert.equal(alteredMarketplaceResponse.status, 409, 'same key with changed intent must conflict');
  const alteredMarketplaceBody = await alteredMarketplaceResponse.json();
  assert.equal(alteredMarketplaceBody.error?.code, 'IDEMPOTENCY_KEY_REUSED');

  const mixedVerificationDb = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const mixedOrderId = mixedCommittedBody.marketplace_order_id;
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_orders WHERE id = ?').get(mixedOrderId).n, 1);
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate seller orders');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_payment_allocations WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate payment allocations');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_settlements WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'mixed checkout retry must not duplicate settlements');
    assert.equal(mixedVerificationDb.prepare('SELECT COUNT(*) AS n FROM marketplace_inventory_reservations WHERE marketplace_order_id = ?').get(mixedOrderId).n, 1,
      'only the product line should create a physical inventory reservation');
    assert.equal(mixedVerificationDb.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE reference_type = 'marketplace_order' AND reference_id = ?").get(mixedOrderId).n, 1,
      'product stock should be decremented once despite retry');
    const balance = mixedVerificationDb.prepare(`SELECT COALESCE(SUM(quantity), 0) AS quantity
      FROM inventory_movements WHERE organization_id = ? AND location_id = ? AND product_id = ?`).get(
      String(tenant.organizationId), String(defaultLocationId), 'soap-http');
    assert.equal(Number(balance.quantity), 6, 'product stock should move from 8 to 6 exactly once');
    const serviceReservation = mixedVerificationDb.prepare(`SELECT COUNT(*) AS n FROM marketplace_inventory_reservations
      WHERE marketplace_order_id = ? AND product_id = ?`).get(mixedOrderId, 'consultation-http');
    assert.equal(serviceReservation.n, 0, 'service line must not create a physical reservation');
  } finally {
    mixedVerificationDb.close();
  }

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

  // End-to-end client recovery: run the real syncOrders implementation
  // against this live backend. The first POST is committed and its response
  // is deliberately discarded; retry must recover the same order/payment IDs.
  const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
  const executableOrdersSource = ordersSource
    .replace(/^import.*;$/gm, '')
    .replace('export async function syncOrders()', 'async function syncOrders()')
    + '\nglobalThis.__syncOrders = syncOrders;';

  const lostResponseOrder = {
    id: 'service-http-lost-response-order',
    status: 'queued',
    currency: 'ETB',
    items: [{ id: 'consultation-http', name: 'Consultation', price: 25000, qty: 1, currency: 'ETB', item_type: 'service' }],
  };
  let runtimeOrders = [lostResponseOrder];
  const persistedOrders = [];
  let postAttempts = 0;
  let firstCommittedIdentity = null;
  const runtimeContext = {
    STORAGE_KEYS: { orders: 'orders' },
    config: { syncUrl: baseUrl, chatId: tenant.chatId, sessionToken: session.token },
    get orders() { return runtimeOrders; },
    set orders(next) { runtimeOrders = next; },
    setOrders(next) { runtimeOrders = next; },
    saveJSON(key, value) { if (key === 'orders') persistedOrders.push(structuredClone(value)); },
    tenantAuthHeaders() { return authHeaders; },
    applyStoreBranding() {},
    t(key) { return key; },
    renderAll() {},
    refreshPaymentProjection: async () => {},
    ensurePaymentForSyncedOrder: async () => {},
    console: { error() {}, warn() {}, log() {} },
    Date,
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {
        postAttempts += 1;
        const response = await fetch(url, options);
        if (!response.ok) throw new Error('Unexpected HTTP failure: ' + response.status);
        const body = await response.json();
        if (postAttempts === 1) {
          // The backend has committed and returned canonical identities, but
          // the client loses the response before syncOrders can consume it.
          firstCommittedIdentity = body.results[0];
          throw new Error('simulated connection loss after committed HTTP response');
        }
        return { ok: true, json: async () => body };
      }
      // Pulls are not part of this focused push/recovery assertion.
      return { ok: true, json: async () => url.includes('/orders/') ? { orders: [] } : { new_orders: [] } };
    },
  };
  vm.runInNewContext(executableOrdersSource, runtimeContext, { timeout: 1000 });
  const syncOrdersRuntime = runtimeContext.__syncOrders;
  assert.equal(await syncOrdersRuntime(), 'orderSyncFailed');
  assert.equal(runtimeOrders[0].status, 'queued', 'lost response must leave local order retryable');
  assert.equal(runtimeOrders[0].sync_attempts, 1);
  assert.equal(persistedOrders.at(-1)[0].status, 'queued');
  assert.equal(firstCommittedIdentity?.status, 'synced', 'first server request must really commit');
  assert.ok(firstCommittedIdentity?.order_id);
  assert.ok(firstCommittedIdentity?.payment_id);

  assert.match(await syncOrdersRuntime(), /orderSyncedMsg/);
  assert.equal(postAttempts, 2);
  assert.equal(runtimeOrders[0].status, 'synced');
  assert.equal(runtimeOrders[0].server_order_id, firstCommittedIdentity.order_id);
  assert.equal(persistedOrders.at(-1)[0].status, 'synced');
  const recoveredPayment = (await store.listPayments(tenant.chatId))
    .filter(payment => payment.id === firstCommittedIdentity.payment_id);
  assert.equal(recoveredPayment.length, 1, 'response-loss retry must not duplicate canonical payment');
  assert.equal((await store.getOrders(tenant.chatId))
    .filter(item => item.id === lostResponseOrder.id).length, 1,
  'response-loss retry must not duplicate canonical order');

  console.log('PASS: service catalog HTTP journey, actual frontend sync response-loss recovery, and idempotent order sync');
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
