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


async function verifiedPayment(customerId, paymentOrderId, amountMinor) {
  const created = await store.createPayment(chatId, {
    orderId: paymentOrderId, customerId, amountMinor, currency: 'ETB',
  }, { userId: user.id });
  await store.transitionPayment(chatId, created.id, 'RECEIVED', { userId: user.id });
  await store.transitionPayment(chatId, created.id, 'VERIFIED', { userId: user.id });
  return created;
}

const sameCustomerOrder = await store.saveQueuedOrders(chatId, [{
  id: `same-customer-order-${Date.now()}`, customer_id: customer.id, currency: 'ETB',
  items: [{ id: 'p2', name: 'Second Order Product', price: 5000, qty: 1 }], total: 5000,
}]);
assert.equal(sameCustomerOrder[0].status, 'synced');
const sameCustomerReceivable = await store.createReceivable(chatId, {
  sourceType: 'order', sourceId: sameCustomerOrder[0].order_id,
}, { userId: user.id });
const wrongOrderPayment = await verifiedPayment(customer.id, orderId, 5000);
await assert.rejects(
  () => store.allocatePaymentToReceivable(chatId, sameCustomerReceivable.id, {
    paymentId: wrongOrderPayment.id, amountMinor: 5000,
  }, { userId: user.id }),
  error => error?.code === 'PAYMENT_ORDER_MISMATCH' && error?.statusCode === 409,
);
assert.equal((await store.getReceivable(chatId, sameCustomerReceivable.id)).outstandingMinor, 5000,
  'a payment for another order must not reduce this receivable');

const otherCustomer = await store.upsertCustomer(chatId, {
  id: `business-other-${Date.now()}`, customerType: 'business', name: 'Other AR Buyer',
});
const otherTerms = await store.createCreditTerms(chatId, {
  customerId: otherCustomer.id, creditLimitMinor: 100000, paymentDueDays: 30, requiresPo: false,
}, { userId: user.id });
await store.transitionCreditTerms(chatId, otherTerms.id, 'APPROVED', { userId: user.id });
const otherOrder = await store.saveQueuedOrders(chatId, [{
  id: `other-customer-order-${Date.now()}`, customer_id: otherCustomer.id, currency: 'ETB',
  items: [{ id: 'p3', name: 'Other Customer Product', price: 5000, qty: 1 }], total: 5000,
}]);
assert.equal(otherOrder[0].status, 'synced');
const otherReceivable = await store.createReceivable(chatId, {
  sourceType: 'order', sourceId: otherOrder[0].order_id,
}, { userId: user.id });
const wrongCustomerPayment = await verifiedPayment(customer.id, orderId, 5000);
await assert.rejects(
  () => store.allocatePaymentToReceivable(chatId, otherReceivable.id, {
    paymentId: wrongCustomerPayment.id, amountMinor: 5000,
  }, { userId: user.id }),
  error => error?.code === 'PAYMENT_CUSTOMER_MISMATCH' && error?.statusCode === 409,
);
assert.equal((await store.getReceivable(chatId, otherReceivable.id)).outstandingMinor, 5000,
  'a payment owned by another customer must not reduce this receivable');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ar_payment_allocations').get().n, 2,
  'rejected cross-order and cross-customer allocations must not create allocation rows');

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Accounts Receivable Regression: PASS');
