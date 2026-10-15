import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Run the authenticated seller HTTP contract against isolated SQLite, then
// verify the existing PWA sync clients use the same routes and tenant auth.
// FUX-59 covers deeper canonical fulfillment and stock consequences.
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-first-sale-http-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;

let child = null;
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
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('Health endpoint returned ' + response.status);
    } catch (error) { lastError = error; }
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

  const auth = { Authorization: 'Bearer ' + session.token };
  const catalog = [
    { id: 'fux60-physical', name: 'Coffee beans', price: 120, stock: 5, type: 'product' },
    { id: 'fux60-service', name: 'Barista training', price: 900, type: 'service' },
  ];
  const catalogResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ products: catalog }),
  });
  assert.equal(catalogResponse.status, 200, 'authenticated catalog sync is accepted');
  const catalogData = await catalogResponse.json();
  assert.ok(Array.isArray(catalogData.products), 'catalog sync returns the canonical catalog');
  const persistedCatalog = await store.getCatalog(tenant.chatId);
  assert.equal(persistedCatalog.products.find(item => item.id === 'fux60-physical')?.type, 'product');
  assert.equal(persistedCatalog.products.find(item => item.id === 'fux60-service')?.type, 'service');

  const localId = 'fux60-local-' + randomUUID();
  const localOrder = {
    id: localId, currency: 'ETB', customer_name: 'First Sale Buyer',
    // Client claims are deliberately untrusted: the canonical order/payment
    // boundary must not treat these as evidence of a completed payment.
    payment_state: 'PAID', paid: true, payment_proof: { status: 'VERIFIED' },
    items: [
      { id: 'fux60-physical', name: 'Coffee beans', qty: 2, price: 120, type: 'service' },
      { id: 'fux60-service', name: 'Barista training', qty: 1, price: 900, type: 'product' },
    ],
    fulfillment_type: 'delivery', delivery_address: 'Addis Ababa',
  };
  const syncResponse = await fetch(baseUrl + '/sync/' + encodeURIComponent(tenant.chatId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ orders: [localOrder] }),
  });
  assert.equal(syncResponse.status, 200, 'authenticated order sync is accepted');
  const syncData = await syncResponse.json();
  const acknowledgement = (syncData.results || []).find(result => result.local_id === localId);
  assert.equal(acknowledgement?.status, 'synced', 'server acknowledges the local order');
  assert.ok(acknowledgement?.order_id, 'acknowledgement returns canonical server order ID');

  // Lost acknowledgements and concurrent client retries must reuse the same
  // canonical order/payment identities rather than create another payment shell.
  const retryResponses = await Promise.all(Array.from({ length: 5 }, () => fetch(
    baseUrl + '/sync/' + encodeURIComponent(tenant.chatId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ orders: [localOrder] }),
    },
  )));
  assert.ok(retryResponses.every(response => response.status === 200),
    'concurrent identical order-sync retries are accepted idempotently');
  const retryPayloads = await Promise.all(retryResponses.map(response => response.json()));
  const retryAcks = retryPayloads.map(payload =>
    (payload.results || []).find(result => result.local_id === localId));
  assert.ok(retryAcks.every(result => result?.status === 'synced'),
    'each retry receives a successful sync acknowledgement');
  assert.ok(retryAcks.every(result => result.order_id === acknowledgement.order_id),
    'retries reuse the same canonical server order ID');
  assert.ok(retryAcks.every(result => result.payment_id === acknowledgement.payment_id),
    'retries reuse the same canonical payment identity');

  const conflictingRetry = await fetch(baseUrl + '/sync/' + encodeURIComponent(tenant.chatId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ orders: [{
      ...localOrder,
      items: [...localOrder.items, { id: 'fux60-physical', name: 'Coffee beans', qty: 1, price: 120 }],
    }] }),
  });
  assert.equal(conflictingRetry.status, 200, 'order identity conflict is reported in the sync result');
  const conflictingPayload = await conflictingRetry.json();
  const conflictingAck = (conflictingPayload.results || []).find(result => result.local_id === localId);
  assert.equal(conflictingAck?.status, 'rejected',
    'reusing a local order identity with changed contents is rejected');
  assert.equal(conflictingAck?.code, 'ORDER_IDEMPOTENCY_CONFLICT',
    'changed order retry receives the stable idempotency conflict code');

  const persistedOrders = await store.getOrders(tenant.chatId);
  const persistedOrder = persistedOrders.find(order => order.server_order_id === acknowledgement.order_id);
  assert.ok(persistedOrder, 'HTTP-submitted order is persisted in canonical SQLite storage');
  assert.equal(persistedOrder.items.length, 2);
  assert.equal(persistedOrder.total, 1140);

  // Order sync may establish canonical payment identity, but client-supplied
  // payment claims/proof cannot advance financial state. Payment Core remains
  // the authority for order-level PAID/PARTIAL/UNPAID.
  const canonicalPayments = await store.listPayments(tenant.chatId, { orderId: acknowledgement.order_id, limit: 10 });
  assert.ok(canonicalPayments.length >= 1, 'sync establishes canonical payment identity for the accepted order');
  assert.equal(canonicalPayments.length, 1,
    'repeated sync retries do not create duplicate initial canonical payment shells');
  assert.ok(canonicalPayments.every(payment => payment.state === 'UNPAID'),
    'untrusted client payment claims do not mark canonical payments paid');
  const canonicalSummary = await store.getOrderPaymentSummary(tenant.chatId, acknowledgement.order_id);
  assert.equal(canonicalSummary.status, 'UNPAID',
    'order-level financial status stays unpaid until Payment Core verifies payment');
  assert.equal(canonicalSummary.verifiedMinor, 0);
  assert.equal(canonicalSummary.outstandingMinor, 1140);

  // Verify the actual PWA client source uses the same authenticated HTTP contract.
  const catalogClient = await readFile('app/src/sync/catalog.js', 'utf8');
  const orderClient = await readFile('app/src/sync/orders.js', 'utf8');
  assert.match(catalogClient, /tenantAuthHeaders\(\)/, 'catalog client attaches tenant session headers');
  assert.match(catalogClient, /\/catalog\/\$\{config\.chatId\}/, 'catalog client calls canonical catalog route');
  assert.match(orderClient, /authHeaders\(\)/, 'order client attaches tenant session headers');
  assert.match(orderClient, /\/sync\/\$\{config\.chatId\}/, 'order client calls canonical sync route');
  assert.match(orderClient, /result\.payment_id/, 'PWA persists canonical payment identity from sync acknowledgement');
  assert.match(orderClient, /status: 'LINKED'/, 'PWA marks only canonical identity linkage, not payment verification');
  assert.match(orderClient, /payment_intent_id: result\.payment_intent_id \? String\(result\.payment_intent_id\) : null/,
    'PWA retains optional canonical payment-intent identity');
  assert.doesNotMatch(orderClient, /payment_state:\s*result\.payment_state/,
    'sync acknowledgement payment status is not cached as financial truth');
  assert.match(orderClient, /async function retryMissingPaymentLinkages\(\)/,
    'later sync cycles retry canonical payment linkage when the original attempt was deferred');
  assert.match(orderClient, /await retryMissingPaymentLinkages\(\)/,
    'the no-queued-orders sync path still recovers missing canonical payment links');
  assert.match(orderClient, /payment_linkage:\s*\{\s*status:\s*'LINKED',\s*payment_id:\s*paymentId,\s*payment_intent_id:\s*intentId,/s,
    'recovered canonical payment identity is persisted locally for subsequent syncs');
  assert.match(orderClient, /canonical_linkage_only:\s*true/,
    'linkage-only shells remain explicitly marked until a routed financial payment exists');
  assert.match(orderClient, /String\(\(order\.payment_linkage && order\.payment_linkage\.status\) \|\| ''\)\.toUpperCase\(\) !== 'LINKED'/,
    'recovery still checks whether a canonical payment link exists');
  assert.match(orderClient, /Boolean\(order\.payment_linkage && order\.payment_linkage\.canonical_linkage_only\)/,
    'linkage-only identity shells remain eligible for recovery until a routed payment exists');

  const unauthorized = await fetch(baseUrl + '/catalog/' + encodeURIComponent(tenant.chatId), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [{ id: 'fux60-forged', name: 'Forged', price: 1 }] }),
  });
  assert.equal(unauthorized.status, 401, 'catalog write is rejected without a tenant session');
  assert.equal((await store.getCatalog(tenant.chatId)).products.some(item => item.id === 'fux60-forged'), false);

  console.log('FUX-60 authenticated HTTP -> SQLite first-sale integration: PASS');
  console.log('PWA catalog/order sync route and tenant-auth source contract: PASS');
  console.log('Mixed physical/service order canonical ID and persistence: PASS');
  console.log('Unauthenticated catalog mutation rejected without persistence: PASS');
} catch (error) {
  if (child) { try { child.kill('SIGTERM'); } catch {} }
  throw error;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 1500);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  await rm(tempDir, { recursive: true, force: true });
}
