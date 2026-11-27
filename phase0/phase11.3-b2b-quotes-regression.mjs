import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'sellify-11-3-quotes-'));
process.env.SELLIFY_DATA_DIR = tmp;
process.env.SELLIFY_DB_PATH = path.join(tmp, 'test.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const user = await store.getOrCreateUserByTelegram(`tg-${Date.now()}`, 'Quote Test');
const tenant = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'Quote Test',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const chatId = tenant.chatId;

const customer = await store.upsertCustomer(chatId, { id: `customer-${Date.now()}`, customerType: 'business', name: 'Acme Ltd' });
await store.saveCatalog(chatId, [
  { id: 'cement', name: 'Cement', price: 12500, currency: 'ETB', stock: 100 },
  { id: 'future-cement', name: 'Future Cement', price: 13000, currency: 'ETB', stock: 100 },
  { id: 'expired-cement', name: 'Expired Cement', price: 14000, currency: 'ETB', stock: 100 },
  { id: 'bounded-cement', name: 'Bounded Cement', price: 15000, currency: 'ETB', stock: 100 },
]);
const rule = await store.upsertCustomerPricing(chatId, { customerId: customer.id, productId: 'cement', priceMinor: 11000, currency: 'ETB' }, { userId: user.id });

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

// Caller-supplied prices in either supported legacy spelling are untrusted.
// The canonical customer price must win even when supplied values undercut it.
const tamperedQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [
    { productId: 'cement', quantity: 1, unitPriceMinor: 1 },
    { productId: 'cement', quantity: 1, unit_price_minor: 2 },
  ],
}, { userId: user.id });
assert.equal(tamperedQuote.subtotalMinor, 22000);
assert.equal(tamperedQuote.totalMinor, 22000);
assert.deepEqual(tamperedQuote.items.map(item => item.unitPriceMinor), [11000, 11000]);
assert.deepEqual(tamperedQuote.items.map(item => item.pricingRuleId), [rule.id, rule.id]);

// Active pricing rules are eligible only inside their explicit UTC instant
// window. Start and end instants are inclusive; absent bounds are open-ended.
await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'future-cement', priceMinor: 9000, currency: 'ETB',
  effectiveFrom: '2099-01-01T00:00:00.000Z',
}, { userId: user.id });
await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'expired-cement', priceMinor: 8000, currency: 'ETB',
  effectiveTo: '2000-01-01T00:00:00.000Z',
}, { userId: user.id });
const boundedRule = await store.upsertCustomerPricing(chatId, {
  customerId: customer.id, productId: 'bounded-cement', priceMinor: 7000, currency: 'ETB',
  effectiveFrom: '2000-01-01T03:00:00.000+03:00',
  effectiveTo: '2099-01-01T03:00:00.000+03:00',
}, { userId: user.id });
assert.equal(boundedRule.effectiveFrom, '2000-01-01T00:00:00.000Z');
assert.equal(boundedRule.effectiveTo, '2099-01-01T00:00:00.000Z');
const windowQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [
    { productId: 'future-cement', quantity: 1 },
    { productId: 'expired-cement', quantity: 1 },
    { productId: 'bounded-cement', quantity: 1 },
  ],
}, { userId: user.id });
assert.deepEqual(windowQuote.items.map(item => item.unitPriceMinor), [13000, 14000, 7000]);
assert.deepEqual(windowQuote.items.map(item => item.pricingRuleId), [null, null, boundedRule.id]);

await assert.rejects(
  () => store.upsertCustomerPricing(chatId, {
    customerId: customer.id, productId: 'cement', priceMinor: 10000, currency: 'ETB',
    effectiveFrom: '2026-02-30T00:00:00.000Z',
  }, { userId: user.id }),
  error => error?.code === 'INVALID_CUSTOM_PRICING_EFFECTIVE_DATE' && error?.statusCode === 400
);
await assert.rejects(
  () => store.upsertCustomerPricing(chatId, {
    customerId: customer.id, productId: 'cement', priceMinor: 10000, currency: 'ETB',
    effectiveFrom: '2099-01-01T00:00:00.000Z',
    effectiveTo: '2000-01-01T00:00:00.000Z',
  }, { userId: user.id }),
  error => error?.code === 'INVALID_CUSTOM_PRICING_EFFECTIVE_WINDOW' && error?.statusCode === 400
);

const sent = await store.transitionQuote(chatId, quote.id, 'SENT', { userId: user.id });
assert.equal(sent.status, 'SENT');
const accepted = await store.transitionQuote(chatId, quote.id, 'ACCEPTED', { userId: user.id });
assert.equal(accepted.status, 'ACCEPTED');
await assert.rejects(
  () => store.transitionQuote(chatId, quote.id, 'CANCELLED', { userId: user.id }),
  error => error?.code === 'INVALID_QUOTE_TRANSITION' && error?.statusCode === 409
);

// Concurrent transitions must serialize against the canonical quote state.
const raceQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 1 }],
  validUntil: '2026-12-31T23:59:59.000Z',
}, { userId: user.id });
await store.transitionQuote(chatId, raceQuote.id, 'SENT', { userId: user.id });
const raceResults = await Promise.allSettled([
  store.transitionQuote(chatId, raceQuote.id, 'ACCEPTED', { userId: user.id }),
  store.transitionQuote(chatId, raceQuote.id, 'REJECTED', { userId: user.id }),
]);
assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1,
  'only one competing quote transition should commit');
assert.equal(raceResults.filter(result => result.status === 'rejected').length, 1,
  'the stale competing quote transition must be rejected');
const rejectedRace = raceResults.find(result => result.status === 'rejected');
assert.ok(['INVALID_QUOTE_TRANSITION', 'QUOTE_STATE_CONFLICT'].includes(rejectedRace.reason?.code));
const db = store.getDatabaseForTests();
const raceAuditCount = db.prepare(
  "SELECT COUNT(*) AS n FROM audit_events WHERE entity_type = 'quote' AND entity_id = ? AND action = 'b2b.quote.transitioned'"
).get(raceQuote.id).n;
assert.equal(raceAuditCount, 2, 'SENT plus exactly one winning transition must be audited');

// Expired quotes cannot be accepted, and their state must remain SENT.
const expiredQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 1 }],
  validUntil: '2020-01-01T00:00:00.000Z',
}, { userId: user.id });
await store.transitionQuote(chatId, expiredQuote.id, 'SENT', { userId: user.id });
await assert.rejects(
  () => store.transitionQuote(chatId, expiredQuote.id, 'ACCEPTED', { userId: user.id }),
  error => error?.code === 'QUOTE_EXPIRED' && error?.statusCode === 409
);
assert.equal((await store.getQuote(chatId, expiredQuote.id)).status, 'SENT');

// Audit insertion failures must roll back both quote creation and transitions.
db.exec(`
  CREATE TRIGGER fail_quote_created_audit
  BEFORE INSERT ON audit_events
  WHEN NEW.action = 'b2b.quote.created'
  BEGIN SELECT RAISE(ABORT, 'injected quote creation audit failure'); END;
`);
const failedCreateId = `quote-audit-fail-${Date.now()}`;
await assert.rejects(
  () => store.createQuote(chatId, {
    id: failedCreateId,
    customerId: customer.id,
    items: [{ productId: 'cement', quantity: 1 }],
  }, { userId: user.id })
);
db.exec('DROP TRIGGER fail_quote_created_audit');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM quotes WHERE id = ?').get(failedCreateId).n, 0,
  'quote creation must roll back when its audit event fails');

const auditFailureQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 1 }],
  validUntil: '2026-12-31T23:59:59.000Z',
}, { userId: user.id });
await store.transitionQuote(chatId, auditFailureQuote.id, 'SENT', { userId: user.id });
db.exec(`
  CREATE TRIGGER fail_quote_transition_audit
  BEFORE INSERT ON audit_events
  WHEN NEW.action = 'b2b.quote.transitioned'
  BEGIN SELECT RAISE(ABORT, 'injected quote transition audit failure'); END;
`);
await assert.rejects(
  () => store.transitionQuote(chatId, auditFailureQuote.id, 'ACCEPTED', { userId: user.id })
);
db.exec('DROP TRIGGER fail_quote_transition_audit');
assert.equal((await store.getQuote(chatId, auditFailureQuote.id)).status, 'SENT',
  'quote state must roll back when its transition audit event fails');
assert.equal(db.prepare(
  "SELECT COUNT(*) AS n FROM audit_events WHERE entity_type = 'quote' AND entity_id = ? AND action = 'b2b.quote.transitioned'"
).get(auditFailureQuote.id).n, 1, 'failed transition must not append an audit record beyond the prior SENT event');

// An unparseable expiry timestamp also fails closed at acceptance.
const invalidExpiryQuote = await store.createQuote(chatId, {
  customerId: customer.id,
  items: [{ productId: 'cement', quantity: 1 }],
  validUntil: 'not-a-date',
}, { userId: user.id });
await store.transitionQuote(chatId, invalidExpiryQuote.id, 'SENT', { userId: user.id });
await assert.rejects(
  () => store.transitionQuote(chatId, invalidExpiryQuote.id, 'ACCEPTED', { userId: user.id }),
  error => error?.code === 'QUOTE_EXPIRED'
);

const listed = await store.listQuotes(chatId, { customerId: customer.id });
assert.ok(listed.some(item => item.id === quote.id), 'original quote remains listable');

const retail = await store.upsertCustomer(chatId, { id: `retail-${Date.now()}`, customerType: 'retail', name: 'Retail' });
await assert.rejects(
  () => store.createQuote(chatId, { customerId: retail.id, items: [{ productId: 'cement', quantity: 1 }] }, { userId: user.id }),
  error => error?.code === 'B2B_CUSTOMER_REQUIRED' && error?.statusCode === 409
);

await rm(tmp, { recursive: true, force: true });
console.log('Phase 11.3 B2B Quotes Regression: PASS');
