import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-ar-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const authz = await import('../backend/lib/authorization.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'AR Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'AR Test', currency: 'ETB' });
const chatId = tenant.chatId;
const customer = await store.upsertCustomer(chatId, { id: `business-${Date.now()}`, customerType: 'business', name: 'AR Buyer' });
const terms = await store.createCreditTerms(chatId, { customerId: customer.id, creditLimitMinor: 100000, paymentDueDays: 30, requiresPo: false }, { userId: user.id });
await store.transitionCreditTerms(chatId, terms.id, 'APPROVED', { userId: user.id });

const sync = await store.saveQueuedOrders(chatId, [{
  id: `local-${Date.now()}`, customer_id: customer.id, currency: 'ETB',
  items: [{ id: 'p1', name: 'AR Product', price: 25000, qty: 2 }], total: 50000,
}]);
assert.equal(sync[0].status, 'synced');
const orderId = sync[0].order_id;

const ar = await store.createReceivable(chatId, { sourceType: 'order', sourceId: orderId, notes: 'Net 30' }, { userId: user.id });
assert.equal(ar.status, 'OPEN');
assert.equal(ar.amountMinor, 50000);
assert.equal(ar.outstandingMinor, 50000);
assert.equal(ar.currency, 'ETB');

await assert.rejects(
  () => store.createReceivable(chatId, { sourceType: 'order', sourceId: orderId }, { userId: user.id }),
  error => error?.code === 'AR_EXISTS' && error?.statusCode === 409
);

const payment = await store.createPayment(chatId, { orderId, customerId: customer.id, amountMinor: 20000, currency: 'ETB' }, { userId: user.id });
await store.transitionPayment(chatId, payment.id, 'RECEIVED', { userId: user.id });
await store.transitionPayment(chatId, payment.id, 'VERIFIED', { userId: user.id });
const partial = await store.allocatePaymentToReceivable(chatId, ar.id, { paymentId: payment.id, amountMinor: 20000 }, { userId: user.id });
assert.equal(partial.status, 'PARTIAL');
assert.equal(partial.outstandingMinor, 30000);

const payment2 = await store.createPayment(chatId, { orderId, customerId: customer.id, amountMinor: 30000, currency: 'ETB' }, { userId: user.id });
await store.transitionPayment(chatId, payment2.id, 'RECEIVED', { userId: user.id });
await store.transitionPayment(chatId, payment2.id, 'VERIFIED', { userId: user.id });
const paid = await store.allocatePaymentToReceivable(chatId, ar.id, { paymentId: payment2.id, amountMinor: 30000 }, { userId: user.id });
assert.equal(paid.status, 'PAID');
assert.equal(paid.outstandingMinor, 0);

await assert.rejects(
  () => store.transitionReceivable(chatId, ar.id, 'OPEN', { userId: user.id }),
  error => error?.code === 'INVALID_AR_TRANSITION' && error?.statusCode === 409
);

const ledger = await store.listReceivableLedger(chatId, ar.id);
assert.equal(ledger.length, 3);
assert.equal(ledger[0].entryType, 'CHARGE');
assert.equal(ledger[1].entryType, 'PAYMENT');
assert.equal(ledger[2].entryType, 'PAYMENT');

const db = store.getDatabaseForTests();
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 18').get()?.version, 18);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ar_payment_allocations').get().n, 2);

const buyer = { userId: 'buyer-1', role: 'buyer', organizationId: tenant.organizationId };
assert.equal(authz.authorize(buyer, tenant.organizationId, null, 'b2b_receivables', 'b2b:ar:view'), authz.AUTHZ.DENY);
const manager = { userId: 'manager-1', role: 'manager', organizationId: tenant.organizationId };
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_receivables', 'b2b:ar:view'), authz.AUTHZ.ALLOW);
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_receivables', 'b2b:ar:allocate'), authz.AUTHZ.ALLOW);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Accounts Receivable Regression: PASS');
