import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');

const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'B2B Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'B2B Test', currency: 'ETB' });
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
