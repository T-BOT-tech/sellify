import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-invoice-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');
const store = await import('../backend/lib/store-sqlite.js');
const authz = await import('../backend/lib/authorization.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'Invoice Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'Invoice Test', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const chatId = tenant.chatId;
const customer = await store.upsertCustomer(chatId, { id: `business-${Date.now()}`, customerType: 'business', name: 'Invoice Buyer' });
const terms = await store.createCreditTerms(chatId, { customerId: customer.id, creditLimitMinor: 100000, paymentDueDays: 30, requiresPo: false }, { userId: user.id });
await store.transitionCreditTerms(chatId, terms.id, 'APPROVED', { userId: user.id });
const sync = await store.saveQueuedOrders(chatId, [{ id: `local-${Date.now()}`, customer_id: customer.id, currency: 'ETB', items: [{ id: 'p1', name: 'Invoice Product', price: 250, qty: 2 }], total: 500 }]);
assert.equal(sync[0].status, 'synced');
await assert.rejects(
  () => store.createReceivable(chatId, { sourceType: 'order', sourceId: sync[0].order_id }, { userId: user.id }),
  error => error?.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error?.statusCode === 409,
);
await store.reviewOrderPricing(chatId, sync[0].order_id, 'ACCEPT_AS_SUBMITTED',
  'Reviewed the submitted B2B order price and accepted it.', { userId: user.id });
const ar = await store.createReceivable(chatId, { sourceType: 'order', sourceId: sync[0].order_id }, { userId: user.id });
const invoice = await store.createInvoice(chatId, { receivableId: ar.id, notes: 'Net 30 invoice' }, { userId: user.id });
assert.equal(invoice.status, 'DRAFT');
assert.equal(invoice.totalMinor, 500);
assert.equal(invoice.currency, 'ETB');
assert.equal(invoice.items.length, 1);
assert.equal(invoice.items[0].lineTotalMinor, 500);

const rejectedSync = await store.saveQueuedOrders(chatId, [{
  id: `invoice-rejected-price-${Date.now()}`,
  customer_id: customer.id,
  currency: 'ETB',
  items: [{ id: 'p1', name: 'Invoice Product', price: 300, qty: 1 }],
}]);
assert.equal(rejectedSync[0].status, 'synced');
await store.reviewOrderPricing(chatId, rejectedSync[0].order_id, 'REJECT',
  'Submitted price rejected because it is unsupported by available evidence.', { userId: user.id });
await assert.rejects(
  () => store.createReceivable(chatId, { sourceType: 'order', sourceId: rejectedSync[0].order_id }, { userId: user.id }),
  error => error?.code === 'ORDER_PRICING_REVIEW_REJECTED' && error?.statusCode === 409,
);

const legacySync = await store.saveQueuedOrders(chatId, [{
  id: `invoice-legacy-price-${Date.now()}`,
  customer_id: customer.id,
  currency: 'ETB',
  items: [{ id: 'p1', name: 'Invoice Product', price: 275, qty: 1 }],
}]);
assert.equal(legacySync[0].status, 'synced');
const orderDb = store.getDatabaseForTests();
const legacyRow = orderDb.prepare('SELECT local_id, order_json FROM orders WHERE server_order_id = ?').get(legacySync[0].order_id);
const legacyJson = JSON.parse(legacyRow.order_json);
delete legacyJson.pricing_review;
orderDb.prepare('UPDATE orders SET order_json = ? WHERE chat_id = ? AND local_id = ?')
  .run(JSON.stringify(legacyJson), chatId, legacyRow.local_id);
await assert.rejects(
  () => store.createReceivable(chatId, { sourceType: 'order', sourceId: legacySync[0].order_id }, { userId: user.id }),
  error => error?.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error?.statusCode === 409,
);
const legacyDecision = await store.reviewOrderPricing(chatId, legacySync[0].order_id, 'ACCEPT_AS_SUBMITTED',
  'Reviewed legacy order price and explicitly accepted the submitted amount.', { userId: user.id });
assert.equal(legacyDecision.pricing_review.source, 'LEGACY_UNATTRIBUTED');
assert.equal(legacyDecision.pricing_review.status, 'APPROVED');
await store.createReceivable(chatId, { sourceType: 'order', sourceId: legacySync[0].order_id }, { userId: user.id });

const issued = await store.transitionInvoice(chatId, invoice.id, 'ISSUED', { userId: user.id });
assert.equal(issued.status, 'ISSUED');
await assert.rejects(() => store.transitionInvoice(chatId, invoice.id, 'DRAFT', { userId: user.id }), e => e?.code === 'INVALID_INVOICE_TRANSITION' && e?.statusCode === 409);

// Competing transitions must serialize against canonical state. Exactly one
// DRAFT -> ISSUED / DRAFT -> CANCELLED command may win.
const raceSync = await store.saveQueuedOrders(chatId, [{
  id: `invoice-race-${Date.now()}`,
  customer_id: customer.id,
  currency: 'ETB',
  items: [{ id: 'p1', name: 'Invoice Product', price: 250, qty: 2 }],
  total: 500,
}]);
assert.equal(raceSync[0].status, 'synced');
await store.reviewOrderPricing(chatId, raceSync[0].order_id, 'ACCEPT_AS_SUBMITTED',
  'Reviewed the competing B2B order price and accepted it.', { userId: user.id });
const raceAr = await store.createReceivable(chatId, { sourceType: 'order', sourceId: raceSync[0].order_id }, { userId: user.id });
const raceInvoice = await store.createInvoice(chatId, { receivableId: raceAr.id }, { userId: user.id });
const raceResults = await Promise.allSettled([
  store.transitionInvoice(chatId, raceInvoice.id, 'ISSUED', { userId: user.id }),
  store.transitionInvoice(chatId, raceInvoice.id, 'CANCELLED', { userId: user.id }),
]);
assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1,
  'only one competing invoice transition should commit');
assert.equal(raceResults.filter(result => result.status === 'rejected').length, 1,
  'the stale competing invoice transition should be rejected');
const rejectedRace = raceResults.find(result => result.status === 'rejected');
assert.ok(['INVALID_INVOICE_TRANSITION', 'INVOICE_STATE_CONFLICT'].includes(rejectedRace.reason?.code));
const persistedRaceInvoice = await store.getInvoice(chatId, raceInvoice.id);
assert.ok(['ISSUED', 'CANCELLED'].includes(persistedRaceInvoice.status));
await assert.rejects(() => store.createInvoice(chatId, { receivableId: ar.id }, { userId: user.id }), e => e?.code === 'INVOICE_EXISTS' && e?.statusCode === 409);
const db = store.getDatabaseForTests();
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 19').get()?.version, 19);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 2);
assert.equal(authz.authorize({ userId: 'buyer', role: 'buyer', organizationId: tenant.organizationId }, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:view'), authz.AUTHZ.DENY);
const manager = { userId: 'manager', role: 'manager', organizationId: tenant.organizationId };
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:view'), authz.AUTHZ.ALLOW);
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:create'), authz.AUTHZ.ALLOW);
await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Invoice Regression: PASS');
