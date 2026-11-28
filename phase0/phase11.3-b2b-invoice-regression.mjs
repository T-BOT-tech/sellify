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
const ar = await store.createReceivable(chatId, { sourceType: 'order', sourceId: sync[0].order_id }, { userId: user.id });
const invoice = await store.createInvoice(chatId, { receivableId: ar.id, notes: 'Net 30 invoice' }, { userId: user.id });
assert.equal(invoice.status, 'DRAFT');
assert.equal(invoice.totalMinor, 500);
assert.equal(invoice.currency, 'ETB');
assert.equal(invoice.items.length, 1);
assert.equal(invoice.items[0].lineTotalMinor, 500);
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

// Concurrent invoice creation for one receivable must serialize duplicate detection.
const createRaceSync = await store.saveQueuedOrders(chatId, [{
  id: `invoice-create-race-${Date.now()}`, customer_id: customer.id, currency: 'ETB',
  items: [{ id: 'p1', name: 'Invoice Product', price: 250, qty: 2 }], total: 500,
}]);
assert.equal(createRaceSync[0].status, 'synced');
const createRaceAr = await store.createReceivable(chatId, { sourceType: 'order', sourceId: createRaceSync[0].order_id }, { userId: user.id });
const createRaceResults = await Promise.allSettled([
  store.createInvoice(chatId, { receivableId: createRaceAr.id }, { userId: user.id }),
  store.createInvoice(chatId, { receivableId: createRaceAr.id }, { userId: user.id }),
]);
assert.equal(createRaceResults.filter(result => result.status === 'fulfilled').length, 1);
assert.equal(createRaceResults.filter(result => result.status === 'rejected' && result.reason?.code === 'INVOICE_EXISTS').length, 1);

// A mandatory audit failure must roll back both invoice header and item rows.
const failedAuditSync = await store.saveQueuedOrders(chatId, [{
  id: `invoice-audit-failure-${Date.now()}`, customer_id: customer.id, currency: 'ETB',
  items: [{ id: 'p1', name: 'Invoice Product', price: 250, qty: 2 }], total: 500,
}]);
assert.equal(failedAuditSync[0].status, 'synced');
const failedAuditAr = await store.createReceivable(chatId, { sourceType: 'order', sourceId: failedAuditSync[0].order_id }, { userId: user.id });
db.exec(`
  CREATE TRIGGER fail_b2b_invoice_audit_insert
  BEFORE INSERT ON audit_events
  WHEN NEW.entity_type = 'invoices'
  BEGIN SELECT RAISE(ABORT, 'forced invoice audit failure'); END;
`);
try {
  await assert.rejects(
    () => store.createInvoice(chatId, { receivableId: failedAuditAr.id }, { userId: user.id }),
    /forced invoice audit failure/
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE receivable_id = ?').get(failedAuditAr.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE receivable_id = ?)').get(failedAuditAr.id).n, 0);
} finally {
  db.exec('DROP TRIGGER IF EXISTS fail_b2b_invoice_audit_insert');
}
const db = store.getDatabaseForTests();
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 19').get()?.version, 19);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 2);
assert.equal(authz.authorize({ userId: 'buyer', role: 'buyer', organizationId: tenant.organizationId }, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:view'), authz.AUTHZ.DENY);
const manager = { userId: 'manager', role: 'manager', organizationId: tenant.organizationId };
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:view'), authz.AUTHZ.ALLOW);
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_invoices', 'b2b:invoice:create'), authz.AUTHZ.ALLOW);
await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Invoice Regression: PASS');
