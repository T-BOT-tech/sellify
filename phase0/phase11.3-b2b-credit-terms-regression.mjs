import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-credit-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const authz = await import('../backend/lib/authorization.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'Credit Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'Credit Test', currency: 'ETB' });
const chatId = tenant.chatId;

const business = await store.upsertCustomer(chatId, { id: `business-${Date.now()}`, customerType: 'business', name: 'Credit Buyer' });
const retail = await store.upsertCustomer(chatId, { id: `retail-${Date.now()}`, customerType: 'retail', name: 'Retail Buyer' });
const business2 = await store.upsertCustomer(chatId, { id: `business2-${Date.now()}`, customerType: 'business', name: 'Second Credit Buyer' });

const pending = await store.createCreditTerms(chatId, {
  customerId: business.id,
  creditLimitMinor: 250000,
  paymentDueDays: 30,
  requiresPo: true,
  reason: 'Net-30 commercial terms',
}, { userId: user.id });
assert.equal(pending.status, 'PENDING');
assert.equal(pending.creditLimitMinor, 250000);
assert.equal(pending.paymentDueDays, 30);
assert.equal(pending.currency, 'ETB');
assert.equal(pending.requiresPo, true);

const edited = await store.updateCreditTerms(chatId, pending.id, { creditLimitMinor: 300000, paymentDueDays: 45 }, { userId: user.id });
assert.equal(edited.creditLimitMinor, 300000);
assert.equal(edited.paymentDueDays, 45);

await assert.rejects(
  () => store.createCreditTerms(chatId, { customerId: retail.id, creditLimitMinor: 1000, paymentDueDays: 7 }, { userId: user.id }),
  error => error?.code === 'B2B_CUSTOMER_REQUIRED' && error?.statusCode === 409
);
await assert.rejects(
  () => store.createCreditTerms(chatId, { customerId: business.id, creditLimitMinor: 1000, paymentDueDays: 366 }, { userId: user.id }),
  error => error?.code === 'INVALID_CREDIT_TERMS' && error?.statusCode === 400
);
await assert.rejects(
  () => store.createCreditTerms(chatId, { customerId: business2.id, creditLimitMinor: 1000, paymentDueDays: 7, currency: 'USD' }, { userId: user.id }),
  error => error?.code === 'CURRENCY_MISMATCH' && error?.statusCode === 409
);

const approved = await store.transitionCreditTerms(chatId, pending.id, 'APPROVED', { userId: user.id });
assert.equal(approved.status, 'APPROVED');
assert.equal(approved.approvedByUserId, user.id);
assert.ok(approved.approvedAt);

await assert.rejects(
  () => store.updateCreditTerms(chatId, pending.id, { creditLimitMinor: 1 }, { userId: user.id }),
  error => error?.code === 'CREDIT_TERMS_IMMUTABLE' && error?.statusCode === 409
);

const suspended = await store.transitionCreditTerms(chatId, pending.id, 'SUSPENDED', { userId: user.id }, 'temporary hold');
assert.equal(suspended.status, 'SUSPENDED');
const reapproved = await store.transitionCreditTerms(chatId, pending.id, 'APPROVED', { userId: user.id });
assert.equal(reapproved.status, 'APPROVED');

await assert.rejects(
  () => store.transitionCreditTerms(chatId, pending.id, 'REJECTED', { userId: user.id }),
  error => error?.code === 'INVALID_CREDIT_TERMS_TRANSITION' && error?.statusCode === 409
);

const listed = await store.listCreditTerms(chatId, { customerId: business.id });
assert.equal(listed.length, 1);
assert.equal(listed[0].id, pending.id);

const db = store.getDatabaseForTests();
assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 17').get()?.version, 17);

const buyer = { userId: 'buyer-1', role: 'buyer', organizationId: tenant.organizationId };
assert.equal(authz.authorize(buyer, tenant.organizationId, null, 'b2b_credit_terms', 'b2b:credit:view'), authz.AUTHZ.DENY);
const manager = { userId: 'manager-1', role: 'manager', organizationId: tenant.organizationId };
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_credit_terms', 'b2b:credit:create'), authz.AUTHZ.ALLOW);
assert.equal(authz.authorize(manager, tenant.organizationId, null, 'b2b_credit_terms', 'b2b:credit:approve'), authz.AUTHZ.ALLOW);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Credit Terms Regression: PASS');
