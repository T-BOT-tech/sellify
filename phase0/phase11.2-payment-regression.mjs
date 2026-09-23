import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase11-2-payment-'));
process.env.SELLIFY_DATA_DIR = dir;
const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram('phase112-payment-user', 'Payment Test');
const tenantResult = await store.createTenantForUser({ userId: user.id, sellerName: 'Payment Test', country: 'ET', currency: 'ETB' });
const chatId = tenantResult.chatId;
const session = await store.createSession({ userId: user.id, chatId });
const tenant = await store.getTenant(chatId);
assert.equal(tenant.branding.currency, 'ETB');

const account = await store.createPaymentAccount(chatId, {
  providerId: 'telebirr', accountIdentifier: '251900000000', phone: '+251900000000'
}, session);
assert.equal(account.providerId, 'telebirr');
assert.equal(account.status, 'active');

await store.saveCatalog(chatId, [{ id: 'pay-product', name: 'Coffee', price: 1000, stock: 10 }]);
const synced = await store.saveQueuedOrders(chatId, [{
  id: 'pay-order-1', currency: 'ETB',
  items: [{ id: 'pay-product', qty: 1, price: 1000, currency: 'ETB' }], total: 1000,
  payment_method_id: 'cash', payment_method_name: 'Cash', cash_tendered: 1000, change_due: 0,
}]);
assert.equal(synced[0].status, 'synced');
const legacyProjection = (await store.listPayments(chatId, { orderId: synced[0].order_id }))[0];
assert.equal(legacyProjection.state, 'RECEIVED');
assert.equal(legacyProjection.amountMinor, 1000);
assert.equal(legacyProjection.currency, 'ETB');

const payment = await store.createPayment(chatId, {
  orderId: synced[0].order_id,
  paymentAccountId: account.id,
  providerId: 'telebirr', channel: 'api',
  amountMinor: 1000, currency: 'ETB',
  methodId: 'telebirr', methodName: 'Telebirr',
  externalReference: 'TB-112-001', state: 'CLAIMED',
}, session);
assert.equal(payment.state, 'CLAIMED');
assert.equal(payment.amountMinor, 1000);

const received = await store.transitionPayment(chatId, payment.id, 'RECEIVED', session, { reason: 'Provider confirmation received' });
assert.equal(received.state, 'RECEIVED');
const verified = await store.transitionPayment(chatId, payment.id, 'VERIFIED', session, { reason: 'Manual verification' });
assert.equal(verified.state, 'VERIFIED');
const reconciliation = await store.reconcilePayment(chatId, payment.id, { amountMinor: 1000, currency: 'ETB', externalReference: 'TB-112-001' }, session);
assert.equal(reconciliation.status, 'matched');
const reconciled = await store.getPayment(chatId, payment.id);
assert.equal(reconciled.state, 'RECONCILED');

const ledger = await store.listPaymentLedger(chatId, payment.id);
assert.deepEqual(ledger.map(e => e.toState), ['CLAIMED', 'RECEIVED', 'VERIFIED', 'RECONCILED']);

await assert.rejects(
  () => store.transitionPayment(chatId, payment.id, 'UNPAID', session),
  error => error?.statusCode === 409 && error?.code === 'INVALID_PAYMENT_TRANSITION'
);

await assert.rejects(
  () => store.createPayment(chatId, { amountMinor: 100, currency: 'USD' }, session),
  error => error?.statusCode === 409 && error?.code === 'CURRENCY_MISMATCH'
);

const db = new (await import('node:sqlite')).DatabaseSync(store.getDatabasePath());
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 13').get().version, 13);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_ledger_entries WHERE payment_id = ?').get(payment.id).n, 4);
assert.throws(() => db.prepare('DELETE FROM payment_ledger_entries WHERE payment_id = ?').run(payment.id), /append-only/);
db.close();

console.log('Phase 11.2 Payment Core Regression: PASS');
await rm(dir, { recursive: true, force: true });
