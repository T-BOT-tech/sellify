import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-po-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const authz = await import('../backend/lib/authorization.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'PO Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'PO Test', currency: 'ETB' });
const chatId = tenant.chatId;

const customer = await store.upsertCustomer(chatId, { id: `customer-${Date.now()}`, customerType: 'business', name: 'Acme Ltd' });
await store.saveCatalog(chatId, [{ id: 'cement', name: 'Cement', price: 12500, currency: 'ETB', stock: 100 }]);
const rule = await store.upsertCustomerPricing(chatId, { customerId: customer.id, productId: 'cement', priceMinor: 11000, currency: 'ETB' }, { userId: user.id });

const quote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 3 }],
  notes: 'Approved commercial quote',
}, { userId: user.id });
await store.transitionQuote(chatId, quote.id, 'SENT', { userId: user.id });
await store.transitionQuote(chatId, quote.id, 'ACCEPTED', { userId: user.id });

const po = await store.createPurchaseOrder(chatId, {
  quoteId: quote.id,
  buyerReference: 'ACME-PO-001',
  notes: 'Buyer purchase order',
}, { userId: user.id });
assert.equal(po.status, 'DRAFT');
assert.equal(po.currency, 'ETB');
assert.equal(po.customerId, customer.id);
assert.equal(po.quoteId, quote.id);
assert.equal(po.subtotalMinor, 33000);
assert.equal(po.totalMinor, 33000);
assert.equal(po.items[0].unitPriceMinor, 11000);
assert.equal(po.items[0].quoteItemId, quote.items[0].id);
assert.equal(po.buyerReference, 'ACME-PO-001');
assert.equal(rule.id, quote.items[0].pricingRuleId);

await assert.rejects(
  () => store.createPurchaseOrder(chatId, { quoteId: quote.id }, { userId: user.id }),
  error => error?.code === 'PO_ALREADY_EXISTS' && error?.statusCode === 409
);

const submitted = await store.transitionPurchaseOrder(chatId, po.id, 'SUBMITTED', { userId: user.id });
assert.equal(submitted.status, 'SUBMITTED');
assert.ok(submitted.submittedAt);

const approved = await store.transitionPurchaseOrder(chatId, po.id, 'APPROVED', { userId: user.id });
assert.equal(approved.status, 'APPROVED');
assert.equal(approved.approvedByUserId, user.id);
assert.ok(approved.approvedAt);

await assert.rejects(
  () => store.transitionPurchaseOrder(chatId, po.id, 'REJECTED', { userId: user.id }, 'too late'),
  error => error?.code === 'INVALID_PO_TRANSITION' && error?.statusCode === 409
);

const listed = await store.listPurchaseOrders(chatId, { customerId: customer.id });
assert.equal(listed.length, 1);
assert.equal(listed[0].id, po.id);

const db = store.getDatabaseForTests();
assert.ok(db);
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 16').get()?.version, 16);
assert.throws(
  () => db.prepare('UPDATE purchase_order_items SET quantity = 99 WHERE purchase_order_id = ?').run(po.id),
  error => String(error?.message || '').includes('submitted purchase order items are immutable')
);

const buyer = { userId: 'buyer-1', role: 'buyer', organizationId: tenant.organizationId };
assert.equal(authz.authorize(buyer, tenant.organizationId, null, 'b2b_purchase_orders', 'b2b:po:create'), authz.AUTHZ.ALLOW);
assert.equal(authz.authorize(buyer, tenant.organizationId, null, 'b2b_purchase_orders', 'b2b:po:approve'), authz.AUTHZ.DENY);
const manager = { userId: 'manager-1', role: 'manager', organizationId: tenant.organizationId };
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_purchase_orders', 'b2b:po:approve'), authz.AUTHZ.ALLOW);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B PO Approval Regression: PASS');
