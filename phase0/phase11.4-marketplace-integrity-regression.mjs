import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const backend = path.join(root, 'backend');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-phase11-4-'));
const port = 20000 + Math.floor(Math.random() * 1000);
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_MAX_WRITES: '1000',
  RATE_LIMIT_MAX_READS: '1000',
};

// The regression also imports the store directly for database assertions and
// fixture setup. Keep the parent process on the exact same isolated SQLite
// database as the HTTP child; otherwise the HTTP server sees an empty test DB
// while the direct store calls populate the default development DB.
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');
process.env.NODE_ENV = 'test';

function request(method, url, body, headers = {}) {
  return fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async response => {
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { response, json, text };
  });
}

async function waitForHealth(child) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await request('GET', '/health');
      if (r.response.ok) return;
    } catch {}
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    await sleep(50);
  }
  throw new Error('server did not become healthy');
}

const child = spawn(process.execPath, [path.join(backend, 'server.js')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', d => stderr += d);

try {
  await waitForHealth(child);
  const store = await import(path.join(backend, 'lib/store-sqlite.js'));

  const sellerUser = await store.getOrCreateUserByTelegram('phase11-4-seller', 'Phase 11.4 Seller');
  const seller = await store.createTenantForUser({
    userId: sellerUser.id,
    sellerName: 'Integrity Seller',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const sellerSession = await store.createSession({ userId: sellerUser.id, chatId: seller.chatId, deviceName: 'Phase 11.4 Seller Device' });
  const auth = { Authorization: `Bearer ${sellerSession.token}` };

  await store.saveCatalog(seller.chatId, [{
      id: 'integrity-item',
      name: 'Integrity Item',
      price: 1000,
      stock: 5,
      marketplace_listed: true,
    }, {
      id: 'delivery-integrity-item',
      name: 'Delivery Integrity Item',
      price: 750,
      stock: 5,
      marketplace_listed: true,
    }]);

  const payload = {
    buyer_id: 'phase11-4-buyer',
    customer_name: 'Integrity Buyer',
    customer_phone: '0900000000',
    items: [{ seller_id: seller.chatId, item_id: 'integrity-item', qty: 2 }],
  };

  const first = await request('POST', '/api/marketplace/checkout', payload, { 'Idempotency-Key': 'phase11-4-idem-1' });
  assert.equal(first.response.status, 200);
  const replay = await request('POST', '/api/marketplace/checkout', payload, { 'Idempotency-Key': 'phase11-4-idem-1' });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.json.marketplace_order_id, first.json.marketplace_order_id);

  const afterReplay = (await store.getCatalog(seller.chatId)).products.find(p => p.id === 'integrity-item');
  assert.equal(afterReplay.stock, 3);

  const db = new DatabaseSync(path.join(dataDir, 'sellify.sqlite'));
  const master = db.prepare('SELECT * FROM marketplace_orders WHERE id = ?').get(first.json.marketplace_order_id);
  assert.equal(master.total_minor, 2000);
  const sellerOrder = db.prepare('SELECT * FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(master.id);
  assert.ok(sellerOrder);
  assert.equal(sellerOrder.subtotal_minor, 2000);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM marketplace_fulfillments WHERE seller_order_id = ?').get(sellerOrder.id).c, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM marketplace_inventory_reservations WHERE seller_order_id = ?').get(sellerOrder.id).c, 1);
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ?').get(sellerOrder.id).status, 'UNPAID');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'PENDING');

  const ledgerAfterCheckout = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS quantity
    FROM inventory_movements
    WHERE organization_id = ? AND product_id = ? AND location_id = (
      SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1
    )
  `).get(sellerSession.organizationId, 'integrity-item', sellerSession.organizationId);
  assert.equal(Number(ledgerAfterCheckout.quantity), 3);

  const legacyOrder = (await store.getOrders(seller.chatId)).find(o => o.marketplace_order_id === master.id);
  assert.ok(legacyOrder);
  const legacyRow = db.prepare('SELECT server_order_id FROM orders WHERE chat_id = ? AND marketplace_order_id = ? LIMIT 1').get(seller.chatId, master.id);
  assert.ok(legacyRow?.server_order_id);
  const payment = await store.createPayment(seller.chatId, {
    orderId: legacyRow.server_order_id,
    amountMinor: 2000,
    currency: 'ETB',
    state: 'UNPAID',
    providerId: 'manual',
    channel: 'manual',
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(payment.amountMinor, 2000);
  await store.transitionPayment(seller.chatId, payment.id, 'VERIFIED', { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'ALLOCATED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'READY');

  // Exercise the canonical cancellation persistence path directly here; route authorization is
  // covered separately, and this regression is specifically about refund/settlement consequences.
  const cancelled = await store.updateMarketplaceOrderStatus(seller.chatId, legacyOrder.id, 'cancelled');
  assert.equal(cancelled.status, 'cancelled');

  const restored = (await store.getCatalog(seller.chatId)).products.find(p => p.id === 'integrity-item');
  assert.equal(restored.stock, 5);
  assert.equal(db.prepare('SELECT status FROM marketplace_inventory_reservations WHERE seller_order_id = ?').get(sellerOrder.id).status, 'released');
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'ALLOCATED',
    'cancellation must not claim an allocation is refunded before Payment Core confirmation');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'HELD',
    'settlement must remain held while the canonical refund is outstanding');
  const marketplaceRefund = db.prepare('SELECT * FROM marketplace_refunds WHERE seller_order_id = ?').get(sellerOrder.id);
  assert.equal(marketplaceRefund.status, 'REQUESTED');
  const canonicalRefund = db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(marketplaceRefund.id);
  assert.ok(canonicalRefund, 'marketplace refund must be the same canonical Payment Core refund');
  assert.equal(canonicalRefund.status, 'REQUESTED');

  const failedRefundAttempt = await store.finalizePaymentRefund(seller.chatId, canonicalRefund.id, {
    status: 'FAILED',
    failureCode: 'PROVIDER_TEMPORARY_FAILURE',
    evidence: { source: 'phase11.4-regression', attempt: 'failed' },
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(failedRefundAttempt.status, 'FAILED');
  assert.equal(db.prepare('SELECT status FROM marketplace_refunds WHERE id = ?').get(marketplaceRefund.id).status, 'REJECTED');
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'ALLOCATED',
    'failed provider outcome must not mark the allocation refunded');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'HELD',
    'failed refund must keep settlement held');

  const finalizedRefund = await store.finalizePaymentRefund(seller.chatId, canonicalRefund.id, {
    status: 'SUCCEEDED',
    providerRefundId: 'phase11-4-confirmed-refund',
    evidence: { source: 'phase11.4-regression' },
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(finalizedRefund.status, 'SUCCEEDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_refunds WHERE id = ?').get(marketplaceRefund.id).status, 'PROCESSED');
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'REFUNDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'REVERSED');
  assert.equal((await store.getPayment(seller.chatId, payment.id)).state, 'REFUNDED');

  const ledgerAfterCancellation = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS quantity
    FROM inventory_movements
    WHERE organization_id = ? AND product_id = ? AND location_id = (
      SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1
    )
  `).get(sellerSession.organizationId, 'integrity-item', sellerSession.organizationId);
  assert.equal(Number(ledgerAfterCancellation.quantity), 5);
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS c FROM inventory_movements
    WHERE event_id = ?
  `).get(`marketplace-cancel:${master.id}:${seller.chatId}:integrity-item`).c, 1);

  // Marketplace delivery uses the canonical Logistics assignment lifecycle,
  // but checkout already owns the physical SALE inventory consequence.
  const deliveryPayload = {
    buyer_id: 'phase11-4-delivery-buyer',
    customer_name: 'Delivery Integrity Buyer',
    customer_phone: '0911111111',
    items: [{ seller_id: seller.chatId, item_id: 'delivery-integrity-item', qty: 2 }],
  };
  const deliveryCheckout = await request('POST', '/api/marketplace/checkout', deliveryPayload, {
    'Idempotency-Key': 'phase11-4-delivery-checkout',
  });
  assert.equal(deliveryCheckout.response.status, 200);
  const deliveryMaster = db.prepare('SELECT * FROM marketplace_orders WHERE id = ?')
    .get(deliveryCheckout.json.marketplace_order_id);
  const deliveryLegacyOrder = (await store.getOrders(seller.chatId))
    .find(order => order.marketplace_order_id === deliveryMaster.id);
  const deliveryOrderRow = db.prepare(
    'SELECT server_order_id FROM orders WHERE chat_id = ? AND marketplace_order_id = ? LIMIT 1'
  ).get(seller.chatId, deliveryMaster.id);
  assert.ok(deliveryLegacyOrder?.is_marketplace, 'Marketplace order marker must survive into Core Order projection');
  assert.ok(deliveryOrderRow?.server_order_id);

  const defaultLocation = db.prepare(
    "SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1"
  ).get(sellerSession.organizationId);
  assert.ok(defaultLocation?.id);
  const courierUser = await store.getOrCreateUserByTelegram('phase11-4-marketplace-courier', 'Marketplace Courier');
  const courierMembershipId = `membership-${courierUser.id}-${seller.chatId}`;
  const courierNow = new Date().toISOString();
  db.prepare('INSERT INTO memberships (id,user_id,chat_id,role,status,created_at) VALUES (?,?,?,\'logistics_courier\',\'active\',?)')
    .run(courierMembershipId, String(courierUser.id), seller.chatId, courierNow);
  db.prepare(`
    INSERT INTO membership_roles (id,membership_id,role_id,status,scope_type,scope_id,source,created_at)
    VALUES (?,?,?,'active','ORGANIZATION',NULL,'PHASE13_10_24_REGRESSION',?)
  `).run(`role-${courierUser.id}-${seller.chatId}`, courierMembershipId, 'logistics_courier', courierNow);

  const dispatcherActor = {
    userId: String(sellerUser.id), role: 'owner', organizationId: String(sellerSession.organizationId),
    chatId: seller.chatId, deviceId: sellerSession.deviceId, locationId: defaultLocation.id,
  };
  const courierActor = {
    userId: String(courierUser.id), role: 'logistics_courier', roles: ['logistics_courier'],
    organizationId: String(sellerSession.organizationId), chatId: seller.chatId,
    deviceId: 'phase13-10-24-courier-device',
  };
  const assigned = await store.assignDeliveryCourier(
    seller.chatId, deliveryOrderRow.server_order_id, courierUser.id, dispatcherActor,
    { locationId: defaultLocation.id, assignmentKey: 'phase13-10-24-marketplace-assignment' },
  );
  assert.equal(assigned.status, 'ASSIGNED');
  const accepted = await store.transitionDeliveryAssignment(
    seller.chatId, deliveryOrderRow.server_order_id, 'ACCEPTED', courierActor,
    { idempotencyKey: 'phase13-10-24-marketplace-accept' },
  );
  assert.equal(accepted.status, 'ACCEPTED');
  const started = await store.transitionDeliveryAssignment(
    seller.chatId, deliveryOrderRow.server_order_id, 'OUT_FOR_DELIVERY', courierActor,
    { idempotencyKey: 'phase13-10-24-marketplace-start' },
  );
  assert.equal(started.status, 'OUT_FOR_DELIVERY');
  const completed = await store.transitionDeliveryAssignment(
    seller.chatId, deliveryOrderRow.server_order_id, 'DELIVERED', courierActor,
    {
      idempotencyKey: 'phase13-10-24-marketplace-delivered',
      proof: { type: 'CUSTOMER_CONFIRMATION', reference: 'marketplace-delivery-proof-1' },
    },
  );
  assert.equal(completed.status, 'DELIVERED');

  const marketplaceDeliveryMovements = db.prepare(`
    SELECT * FROM inventory_movements
    WHERE organization_id = ? AND product_id = 'delivery-integrity-item'
    ORDER BY created_at, id
  `).all(sellerSession.organizationId);
  assert.equal(marketplaceDeliveryMovements.length, 1,
    'Marketplace checkout SALE must remain the only inventory movement after courier completion');
  assert.equal(marketplaceDeliveryMovements[0].movement_type, 'SALE');
  assert.equal(marketplaceDeliveryMovements[0].reference_type, 'marketplace_order');
  assert.equal(Number((await store.getCatalog(seller.chatId)).products.find(p => p.id === 'delivery-integrity-item').stock), 3);
  await assert.rejects(
    () => store.transitionOrderFulfillment(
      seller.chatId, deliveryOrderRow.server_order_id, 'out_for_delivery', dispatcherActor,
      { idempotencyKey: 'phase13-10-24-marketplace-generic-fulfillment' },
    ),
    error => error?.code === 'MARKETPLACE_CORE_FULFILLMENT_UNSUPPORTED' && error?.statusCode === 409,
    'generic Core Fulfillment mutation must reject Marketplace orders explicitly',
  );

  // Split-payment hardening: two payments may cover one seller allocation,
  // but verified value may never exceed the canonical seller-order amount.
  const splitPayload = {
    buyer_id: 'phase11-4-split-buyer',
    items: [{ seller_id: seller.chatId, item_id: 'integrity-item', qty: 1 }],
  };
  const splitOrder = await request('POST', '/api/marketplace/checkout', splitPayload, { 'Idempotency-Key': 'phase11-4-split-order' });
  assert.equal(splitOrder.response.status, 200);
  const splitLegacy = (await store.getOrders(seller.chatId)).find(o => o.marketplace_order_id === splitOrder.json.marketplace_order_id);
  const splitServerOrder = db.prepare('SELECT server_order_id FROM orders WHERE chat_id = ? AND marketplace_order_id = ? LIMIT 1')
    .get(seller.chatId, splitOrder.json.marketplace_order_id).server_order_id;
  const p1 = await store.createPayment(seller.chatId, {
    orderId: splitServerOrder, amountMinor: 400, currency: 'ETB', state: 'UNPAID',
    providerId: 'manual', channel: 'manual',
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  const p2 = await store.createPayment(seller.chatId, {
    orderId: splitServerOrder, amountMinor: 600, currency: 'ETB', state: 'UNPAID',
    providerId: 'manual', channel: 'manual',
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  await store.transitionPayment(seller.chatId, p1.id, 'VERIFIED', { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  await store.transitionPayment(seller.chatId, p2.id, 'VERIFIED', { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  const splitSeller = db.prepare('SELECT id FROM marketplace_seller_orders WHERE marketplace_order_id = ?').get(splitOrder.json.marketplace_order_id);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id IS NOT NULL').get(splitSeller.id).c, 2);
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(splitSeller.id).status, 'READY');
  await assert.rejects(
    () => store.createPayment(seller.chatId, {
      orderId: splitServerOrder, amountMinor: 1, currency: 'ETB', state: 'UNPAID',
      providerId: 'manual', channel: 'manual',
    }, { userId: sellerUser.id, deviceId: sellerSession.deviceId }),
    error => error?.code === 'MARKETPLACE_PAYMENT_ALLOCATION_EXCEEDED'
  );

  // A multi-payment cancellation must keep settlement held until every
  // canonical Payment Core refund has succeeded, not just the first one.
  const splitCancelled = await store.updateMarketplaceOrderStatus(seller.chatId, splitLegacy.id, 'cancelled');
  assert.equal(splitCancelled.status, 'cancelled');
  const splitRefunds = db.prepare(
    'SELECT * FROM marketplace_refunds WHERE seller_order_id = ? ORDER BY payment_id'
  ).all(splitSeller.id);
  assert.equal(splitRefunds.length, 2);
  for (const projectedRefund of splitRefunds) {
    const canonical = db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(projectedRefund.id);
    assert.ok(canonical, 'each marketplace refund must reference a canonical Payment Core refund');
    assert.equal(canonical.status, 'REQUESTED');
    assert.equal(projectedRefund.status, 'REQUESTED');
  }
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(splitSeller.id).status, 'HELD');

  const firstSplitRefund = splitRefunds[0];
  await store.finalizePaymentRefund(seller.chatId, firstSplitRefund.id, {
    status: 'SUCCEEDED',
    providerRefundId: 'phase11-4-split-refund-1',
    evidence: { source: 'phase11.4-regression', split: 1 },
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(splitSeller.id, firstSplitRefund.payment_id).status, 'REFUNDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(splitSeller.id).status, 'HELD',
    'one successful refund must not reverse settlement while another allocation remains outstanding');

  const secondSplitRefund = splitRefunds[1];
  await store.finalizePaymentRefund(seller.chatId, secondSplitRefund.id, {
    status: 'SUCCEEDED',
    providerRefundId: 'phase11-4-split-refund-2',
    evidence: { source: 'phase11.4-regression', split: 2 },
  }, { userId: sellerUser.id, deviceId: sellerSession.deviceId });
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(splitSeller.id, secondSplitRefund.payment_id).status, 'REFUNDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(splitSeller.id).status, 'REVERSED',
    'settlement may reverse only after every split allocation refund is confirmed');

  db.close();

  const racePayload = {
    buyer_id: 'phase11-4-race-buyer',
    items: [{ seller_id: seller.chatId, item_id: 'integrity-item', qty: 4 }],
  };
  const [raceA, raceB] = await Promise.all([
    request('POST', '/api/marketplace/checkout', racePayload, { 'Idempotency-Key': 'phase11-4-race-a' }),
    request('POST', '/api/marketplace/checkout', racePayload, { 'Idempotency-Key': 'phase11-4-race-b' }),
  ]);
  const raceStatuses = [raceA.response.status, raceB.response.status].sort();
  assert.deepEqual(raceStatuses, [200, 409]);

  console.log('Phase 11.4 Marketplace Integrity Regression: PASS');
} catch (error) {
  console.error(stderr);
  console.error('Phase 11.4 Marketplace Integrity Regression: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(dataDir, { recursive: true, force: true });
}
