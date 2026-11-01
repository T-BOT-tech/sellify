import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-first-merchant-sale-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

let child;
let output = '';

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
      throw new Error('Backend exited before health check: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('health returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + lastError?.message + '\n' + output);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(
    'first-merchant-sale-' + Date.now(), 'First Merchant Sale Regression',
  );
  const challenge = await store.createAuthChallenge(user.id);
  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      RATE_LIMIT_MAX_WRITES: '500',
      SERVE_STATIC: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForHealth(baseUrl);

  // Exercise the real tenant-creation HTTP boundary, then keep every following
  // step on the tenant/session returned by that canonical onboarding response.
  const createResponse = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sellerName: 'First Sale Test Store',
      businessType: 'retail',
      country: 'ET',
      currency: 'ETB',
      timezone: 'Africa/Addis_Ababa',
      deviceName: 'First merchant sale regression',
      challengeToken: challenge.token,
    }),
  });
  assert.equal(createResponse.status, 201, 'new merchant should be created through canonical onboarding HTTP');
  const created = await createResponse.json();
  const chatId = String(created.session?.chatId || created.tenant?.chatId || '');
  assert.ok(chatId, 'onboarding response must identify the canonical tenant');
  assert.ok(created.session?.token, 'onboarding response must issue a usable tenant session');
  const headers = {
    Authorization: 'Bearer ' + created.session.token,
    'Content-Type': 'application/json',
  };

  // Persist the chosen business template through the existing owner-authorized
  // endpoint; this is configuration, not Pack activation or readiness.
  const templateUrl = baseUrl + '/tenants/' + encodeURIComponent(chatId) + '/business-template';
  const templateWrite = await fetch(templateUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ templateKey: 'retail-shop' }),
  });
  assert.equal(templateWrite.status, 200, 'new merchant can persist the selected template');
  assert.equal((await templateWrite.json()).businessTemplate.templateKey, 'retail-shop');

  // Create the first physical catalog item through the same canonical HTTP
  // catalog route used by the application, then re-read persisted state.
  const catalogUrl = baseUrl + '/catalog/' + encodeURIComponent(chatId);
  const catalogWrite = await fetch(catalogUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      products: [{
        id: 'first-sale-item',
        name: 'First Sale Item',
        price: 2500,
        currency: 'ETB',
        stock: null,
        item_type: 'product',
        marketplace_listed: true,
      }],
    }),
  });
  assert.equal(catalogWrite.status, 200, 'first catalog item should persist');
  const catalogRead = await fetch(catalogUrl);
  assert.equal(catalogRead.status, 200, 'new merchant catalog should survive a fresh canonical read');
  const catalog = await catalogRead.json();
  assert.equal(catalog.products.find(item => item.id === 'first-sale-item')?.item_type, 'product');
  assert.equal(catalog.products.find(item => item.id === 'first-sale-item')?.price, 2500);

  // Seed opening stock through the existing inventory ledger. The sale must
  // flow through marketplace checkout and canonical inventory movement logic.
  const locations = await store.listOrganizationLocations(chatId);
  const location = locations.find(item => item.is_default) || locations[0];
  assert.ok(location?.id, 'new merchant must have a canonical default inventory location');
  await store.recordInventoryMovement(chatId, {
    productId: 'first-sale-item',
    locationId: String(location.id),
    quantity: 5,
    movementType: 'OPENING_BALANCE',
    referenceType: 'first-merchant-sale-regression',
    referenceId: 'first-sale-opening-stock',
    eventId: 'first-merchant-sale-opening-stock',
    reason: 'Seed first-sale journey regression',
  });

  const checkout = await fetch(baseUrl + '/api/marketplace/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'first-merchant-first-sale-1' },
    body: JSON.stringify({
      buyer_id: 'first-sale-buyer',
      customer_name: 'First Sale Buyer',
      items: [{ seller_id: chatId, item_id: 'first-sale-item', qty: 1 }],
    }),
  });
  assert.equal(checkout.status, 200, 'first product checkout should commit through canonical marketplace checkout');
  const checkoutBody = await checkout.json();
  assert.ok(checkoutBody.marketplace_order_id, 'checkout should return the canonical marketplace order identity');

  const replay = await fetch(baseUrl + '/api/marketplace/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'first-merchant-first-sale-1' },
    body: JSON.stringify({
      buyer_id: 'first-sale-buyer',
      customer_name: 'First Sale Buyer',
      items: [{ seller_id: chatId, item_id: 'first-sale-item', qty: 1 }],
    }),
  });
  assert.equal(replay.status, 200, 'retry of a committed checkout should succeed');
  const replayBody = await replay.json();
  assert.equal(replayBody.marketplace_order_id, checkoutBody.marketplace_order_id,
    'idempotent checkout retry must return the same order rather than duplicate the first sale');

  const orders = await store.getOrders(chatId);
  const canonicalOrder = orders.find(order =>
    order.marketplace_order_id === checkoutBody.marketplace_order_id
    || order.id === checkoutBody.sub_orders?.[0]?.seller_order_id
    || order.server_order_id === checkoutBody.sub_orders?.[0]?.seller_order_id);
  assert.ok(canonicalOrder?.server_order_id,
    'first checkout must create a canonical seller order linked to the marketplace order');
  assert.ok(canonicalOrder.items?.some(line =>
    String(line.item_id || line.id || '') === 'first-sale-item'),
  'canonical order must retain the first catalog item');

  const db = store.getDatabaseForTests();
  const saleMovements = db.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE reference_type = 'marketplace_order' AND reference_id = ? AND product_id = ?"
  ).get(String(checkoutBody.marketplace_order_id), 'first-sale-item').count;
  assert.equal(saleMovements, 1, 'first checkout must decrement stock exactly once despite replay');
  const balance = db.prepare(
    'SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_movements WHERE organization_id = ? AND location_id = ? AND product_id = ?'
  ).get(String(created.session.organizationId), String(location.id), 'first-sale-item');
  assert.equal(Number(balance.quantity), 4, 'canonical stock balance must reflect one completed checkout');

  const payments = await store.listPayments(chatId);
  assert.ok(payments.length > 0, 'checkout must create canonical payment state for the order');
  assert.ok(!payments.some(payment =>
    String(payment.status || '').toUpperCase() === 'SUCCEEDED'
      && !payment.evidence_id && !payment.provider_transaction_id),
  'checkout alone must not fabricate verified payment evidence or provider confirmation');

  console.log('First merchant-to-first-checkout HTTP journey: PASS');
  console.log('Canonical onboarding → template → catalog persistence → checkout replay → order/payment/inventory evidence: PASS');
} catch (error) {
  console.error(error);
  if (output) console.error('Backend output:\n' + output);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempDir, { recursive: true, force: true });
}
