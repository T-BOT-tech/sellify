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
  const paymentAccount = await store.createPaymentAccount(seller.chatId, {
    providerId: 'telebirr',
    accountIdentifier: `251900${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
    phone: '251900000001',
  });

  async function createVerifiedPayment(orderId, amountMinor, label) {
    const created = await store.createPaymentWithIntent(seller.chatId, {
      organizationId: sellerSession.organizationId,
      paymentAccountId: paymentAccount.id,
      providerId: 'telebirr',
      channel: 'manual',
      amountMinor,
      currency: 'ETB',
      orderId,
      idempotencyKey: `phase11-4-${label}-${crypto.randomUUID()}`,
    });
    const payment = created.payment;
    const intent = await store.getPaymentIntent(seller.chatId, payment.paymentIntentId);
    const reference = `PHASE11-4-REF-${payment.id}`;
    const transactionId = `PHASE11-4-TX-${payment.id}`;
    const evidenceResult = await store.insertPaymentEvidence(seller.chatId, {
      paymentId: payment.id,
      paymentIntentId: intent.id,
      providerId: 'telebirr',
      channel: 'manual',
      evidenceType: 'PROVIDER_STATUS',
      externalReference: reference,
      providerTransactionId: transactionId,
      rawPayload: { status: 'COMPLETED', amountMinor, currency: 'ETB', receiverAccount: paymentAccount.accountIdentifier, reference, transactionId },
      normalizedPayload: { result: 'MATCH', observedAmountMinor: amountMinor, observedCurrency: 'ETB', observedReceiverAccount: paymentAccount.accountIdentifier, observedReference: reference, observedTransactionId: transactionId },
      source: 'phase11.4-test',
    });
    const verificationResult = await store.insertPaymentVerification(seller.chatId, {
      paymentId: payment.id,
      paymentIntentId: intent.id,
      evidenceId: evidenceResult.evidence.id,
      providerId: 'telebirr',
      result: 'MATCH',
      observedAmountMinor: amountMinor,
      observedCurrency: 'ETB',
      observedReceiverAccount: paymentAccount.accountIdentifier,
      observedReference: reference,
      observedTransactionId: transactionId,
      observedAt: new Date().toISOString(),
      reasonCodes: [],
      rawResult: { status: 'COMPLETED' },
      verifier: 'payment-core.phase11.4-test',
      verifierVersion: '1',
    });
    await store.commitPaymentDecision(seller.chatId, {
      paymentId: payment.id,
      expectedState: 'UNPAID',
      targetState: 'VERIFIED',
      idempotencyKey: `phase11-4-verify-${payment.id}`,
      verification: {
        ...verificationResult.verification,
        evidenceId: evidenceResult.evidence.id,
        paymentIntentId: intent.id,
        providerId: 'telebirr',
        result: 'MATCH',
      },
      decision: {
        decision: 'ACCEPT',
        targetState: 'VERIFIED',
        reasonCodes: [],
        invariantResults: { passed: true },
        decisionSource: 'PAYMENT_CORE',
        entryType: 'VERIFIED',
      },
    });
    return payment;
  }

  await store.saveCatalog(seller.chatId, [{
      id: 'integrity-item',
      name: 'Integrity Item',
      price: 1000,
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
  const payment = await createVerifiedPayment(legacyRow.server_order_id, 2000, 'full-order');
  assert.equal(payment.amountMinor, 2000);
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'ALLOCATED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'READY');

  // A normal cancellation must not undo an order after courier handoff.
  db.prepare("UPDATE marketplace_fulfillments SET status = 'picked_up' WHERE seller_order_id = ?").run(sellerOrder.id);
  await assert.rejects(
    () => store.updateMarketplaceOrderStatus(seller.chatId, legacyOrder.id, 'cancelled'),
    error => error?.code === 'MARKETPLACE_FULFILLMENT_ALREADY_HANDED_OFF'
  );
  assert.equal(db.prepare('SELECT status FROM orders WHERE chat_id = ? AND local_id = ?').get(seller.chatId, legacyOrder.id).status, 'queued');
  db.prepare("UPDATE marketplace_fulfillments SET status = 'pending' WHERE seller_order_id = ?").run(sellerOrder.id);

  // Exercise the marketplace domain boundary directly here; route/session
  // authorization has separate coverage and should not obscure refund invariants.
  const cancelled = await store.updateMarketplaceOrderStatus(seller.chatId, legacyOrder.id, 'cancelled');
  assert.equal(cancelled.status, 'cancelled');

  const restored = (await store.getCatalog(seller.chatId)).products.find(p => p.id === 'integrity-item');
  assert.equal(restored.stock, 5);
  assert.equal(db.prepare('SELECT status FROM marketplace_inventory_reservations WHERE seller_order_id = ?').get(sellerOrder.id).status, 'released');
  // Cancellation queues a canonical Payment Core refund request; it must
  // not claim the allocation was refunded before provider confirmation.
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'ALLOCATED');
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(sellerOrder.id).status, 'REVERSED');
  const marketplaceRefund = db.prepare('SELECT * FROM marketplace_refunds WHERE seller_order_id = ?').get(sellerOrder.id);
  assert.equal(marketplaceRefund.status, 'REQUESTED');
  const canonicalRefund = db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(marketplaceRefund.id);
  assert.ok(canonicalRefund);
  assert.equal(canonicalRefund.status, 'REQUESTED');

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

  const completedRefund = await store.finalizePaymentRefund(seller.chatId, canonicalRefund.id, {
    status: 'SUCCEEDED',
    providerRefundId: 'phase11-4-refund-confirmed',
    providerTransactionId: 'phase11-4-refund-tx',
    providerResult: { simulated: true },
    evidence: { source: 'phase11.4 regression' },
  });
  assert.equal(completedRefund.status, 'SUCCEEDED');
  assert.equal(db.prepare('SELECT state FROM payments WHERE id = ?').get(payment.id).state, 'REFUNDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(sellerOrder.id, payment.id).status, 'REFUNDED');
  assert.equal(db.prepare('SELECT status FROM marketplace_refunds WHERE id = ?').get(marketplaceRefund.id).status, 'PROCESSED');

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
  const p1 = await createVerifiedPayment(splitServerOrder, 400, 'split-a');
  const p2 = await createVerifiedPayment(splitServerOrder, 600, 'split-b');
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

  // Refunding one split payment must update only that payment's allocation,
  // and must not reverse settlement while the sibling allocation remains active.
  const splitRefundRequest = await store.createPaymentRefundRequest(seller.chatId, {
    paymentId: p1.id,
    amountMinor: 400,
    currency: 'ETB',
    idempotencyKey: 'phase11-4-split-refund-p1',
    reason: 'Regression: seller allocation isolation',
  });
  const splitRefund = splitRefundRequest.refund;
  db.prepare(`
    INSERT INTO marketplace_refunds
      (id, marketplace_order_id, seller_order_id, payment_id, organization_id,
       amount_minor, currency, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?)
  `).run(
    splitRefund.id, splitOrder.json.marketplace_order_id, splitSeller.id, p1.id,
    sellerSession.organizationId, 400, 'ETB', 'Regression: seller allocation isolation',
    new Date().toISOString()
  );
  await store.finalizePaymentRefund(seller.chatId, splitRefund.id, {
    status: 'SUCCEEDED',
    providerRefundId: 'phase11-4-split-refund-p1-confirmed',
    providerTransactionId: 'phase11-4-split-refund-p1-tx',
    providerResult: { simulated: true },
    evidence: { source: 'phase11.4 regression split allocation' },
  });
  assert.equal(
    db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(splitSeller.id, p1.id).status,
    'REFUNDED'
  );
  assert.equal(
    db.prepare('SELECT status FROM marketplace_payment_allocations WHERE seller_order_id = ? AND payment_id = ?').get(splitSeller.id, p2.id).status,
    'ALLOCATED'
  );
  assert.equal(db.prepare('SELECT status FROM marketplace_settlements WHERE seller_order_id = ?').get(splitSeller.id).status, 'READY');

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
