import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'B2B Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'B2B Test', businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const chatId = tenant.chatId;

// Seed a canonical business customer and product through the existing store contracts.
const customer = await store.upsertCustomer(chatId, { id: `customer-${Date.now()}`, customerType: 'business', name: 'Acme Ltd' });
await store.saveCatalog(chatId, [{ id: 'cement', name: 'Cement', price: 12500, currency: 'ETB', stock: 100 }]);

const rule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id,
  productId: 'cement',
  priceMinor: 11000,
  currency: 'ETB',
  reason: 'Contract price',
}, { userId: user.id });
assert.equal(rule.customerId, customer.id);
assert.equal(rule.priceMinor, 11000);
assert.equal(rule.currency, 'ETB');
assert.equal(rule.status, 'active');

const listed = await store.listCustomerPricing(chatId, customer.id, 'cement');
assert.equal(listed.length, 1);

// Repeated POST/upsert without a client-supplied ID must update and return the
// original canonical row rather than looking up the newly generated conflict ID.
const updatedRule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id,
  productId: 'cement',
  priceMinor: 10500,
  currency: 'ETB',
  reason: 'Renewed contract price',
}, { userId: user.id });
assert.ok(updatedRule, 'repeated upsert must return the persisted pricing rule');
assert.equal(updatedRule.id, rule.id, 'unique-key update must retain and return the original row ID');
assert.equal(updatedRule.priceMinor, 10500, 'repeated upsert must persist the updated price');
const afterRepeatedSave = await store.listCustomerPricing(chatId, customer.id, 'cement');
assert.equal(afterRepeatedSave.length, 1, 'repeated upsert must not create a duplicate rule');
assert.equal(afterRepeatedSave[0].id, rule.id);

// Audit provenance must point at the canonical row that SQLite actually updated.
const latestPricingAudit = store.getDatabaseForTests().prepare(
  "SELECT entity_id FROM audit_events WHERE entity_type = 'customer_pricing_rule' ORDER BY rowid DESC LIMIT 1"
).get();
assert.equal(latestPricingAudit?.entity_id, rule.id);

// A pricing mutation and its mandatory audit event must commit atomically.
const db = store.getDatabaseForTests();
db.exec(`
  CREATE TRIGGER fail_customer_pricing_audit_insert
  BEFORE INSERT ON audit_events
  WHEN NEW.entity_type = 'customer_pricing_rule'
  BEGIN
    SELECT RAISE(ABORT, 'forced B2B pricing audit failure');
  END;
`);
try {
  await assert.rejects(
    () => store.upsertCustomerPricing(chatId, {
      customerId: customer.id,
      productId: 'cement',
      priceMinor: 10000,
      currency: 'ETB',
      reason: 'Must roll back with audit failure',
    }, { userId: user.id }),
    /forced B2B pricing audit failure/
  );
  const afterFailedAudit = await store.listCustomerPricing(chatId, customer.id, 'cement');
  assert.equal(afterFailedAudit.length, 1);
  assert.equal(afterFailedAudit[0].priceMinor, 10500,
    'failed pricing audit must roll back the pricing row update');
} finally {
  db.exec('DROP TRIGGER IF EXISTS fail_customer_pricing_audit_insert');
}

await assert.rejects(
  () => store.upsertCustomerPricing(chatId, { customerId: customer.id, productId: 'cement', priceMinor: 10000, currency: 'USD' }, { userId: user.id }),
  error => error?.code === 'CURRENCY_MISMATCH' && error?.statusCode === 409
);

const retail = await store.upsertCustomer(chatId, { id: `retail-${Date.now()}`, customerType: 'retail', name: 'Retail Buyer' });
await assert.rejects(
  () => store.upsertCustomerPricing(chatId, { customerId: retail.id, productId: 'cement', priceMinor: 10000, currency: 'ETB' }, { userId: user.id }),
  error => error?.code === 'B2B_CUSTOMER_REQUIRED' && error?.statusCode === 409
);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Custom Pricing Regression: PASS');
