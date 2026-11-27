import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-quotes-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'Quote Test');
const tenant = await store.createTenantForUser({ userId: user.id, sellerName: 'Quote Test', currency: 'ETB' });
const chatId = tenant.chatId;

const customer = await store.upsertCustomer(chatId, { id: `customer-${Date.now()}`, customerType: 'business', name: 'Acme Ltd' });
await store.saveCatalog(chatId, [{ id: 'cement', name: 'Cement', price: 12500, currency: 'ETB', stock: 100 }]);
const futureRule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'cement', priceMinor: 9000, currency: 'ETB',
  effectiveFrom: '2999-01-01T00:00:00.000Z',
}, { userId: user.id });
const futureRuleQuote = await store.createQuote(chatId, {
  customerId: customer.id, items: [{ productId: 'cement', quantity: 1 }],
}, { userId: user.id });
assert.equal(futureRuleQuote.items[0].unitPriceMinor, 12500);
assert.equal(futureRuleQuote.items[0].pricingRuleId, null);

const expiredRule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'cement', priceMinor: 8000, currency: 'ETB',
  effectiveFrom: '2000-01-01T00:00:00.000Z',
  effectiveTo: '2000-01-02T00:00:00.000Z',
}, { userId: user.id });
const expiredRuleQuote = await store.createQuote(chatId, {
  customerId: customer.id, items: [{ productId: 'cement', quantity: 1 }],
}, { userId: user.id });
assert.equal(expiredRuleQuote.items[0].unitPriceMinor, 12500);
assert.equal(expiredRuleQuote.items[0].pricingRuleId, null);

const currentRule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'cement', priceMinor: 10500, currency: 'ETB',
  effectiveFrom: '2000-01-01T00:00:00.000Z',
  effectiveTo: '2999-01-01T00:00:00.000Z',
}, { userId: user.id });
const currentRuleQuote = await store.createQuote(chatId, {
  customerId: customer.id, items: [{ productId: 'cement', quantity: 1 }],
}, { userId: user.id });
assert.equal(currentRuleQuote.items[0].unitPriceMinor, 10500);
assert.equal(currentRuleQuote.items[0].pricingRuleId, currentRule.id);

await assert.rejects(
  () => store.upsertCustomerPricing(chatId, {
    customerId: customer.id, productId: 'cement', priceMinor: 7000,
    effectiveFrom: 'not-a-date',
  }, { userId: user.id }),
  error => error?.code === 'INVALID_CUSTOM_PRICING_EFFECTIVE_DATE' && error?.statusCode === 400
);
await assert.rejects(
  () => store.upsertCustomerPricing(chatId, {
    customerId: customer.id, productId: 'cement', priceMinor: 7000,
    effectiveFrom: '2027-02-01T00:00:00.000Z',
    effectiveTo: '2027-01-01T00:00:00.000Z',
  }, { userId: user.id }),
  error => error?.code === 'INVALID_CUSTOM_PRICING_EFFECTIVE_RANGE' && error?.statusCode === 400
);

const rule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'cement', priceMinor: 11000, currency: 'ETB',
}, { userId: user.id });

const quote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 3 }],
  validUntil: '2026-12-31T23:59:59.000Z',
  notes: 'Contract quotation',
}, { userId: user.id });
assert.equal(quote.status, 'DRAFT');
assert.equal(quote.currency, 'ETB');
assert.equal(quote.subtotalMinor, 33000);
assert.equal(quote.totalMinor, 33000);
assert.equal(quote.items[0].unitPriceMinor, 11000);
assert.equal(quote.items[0].pricingRuleId, rule.id);

const sent = await store.transitionQuote(chatId, quote.id, 'SENT', { userId: user.id });
assert.equal(sent.status, 'SENT');
const accepted = await store.transitionQuote(chatId, quote.id, 'ACCEPTED', { userId: user.id });
assert.equal(accepted.status, 'ACCEPTED');
await assert.rejects(
  () => store.transitionQuote(chatId, quote.id, 'CANCELLED', { userId: user.id }),
  error => error?.code === 'INVALID_QUOTE_TRANSITION' && error?.statusCode === 409
);

const listed = await store.listQuotes(chatId, { customerId: customer.id });
assert.equal(listed.length, 1);
assert.equal(listed[0].id, quote.id);

const retail = await store.upsertCustomer(chatId, { id: `retail-${Date.now()}`, customerType: 'retail', name: 'Retail' });
await assert.rejects(
  () => store.createQuote(chatId, { customerId: retail.id, items: [{ productId: 'cement', quantity: 1 }] }, { userId: user.id }),
  error => error?.code === 'B2B_CUSTOMER_REQUIRED' && error?.statusCode === 409
);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Quotes Regression: PASS');
