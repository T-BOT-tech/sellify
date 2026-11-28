import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getRolePermissions } from '../backend/lib/authorization.js';

const dir = await mkdtemp(join(tmpdir(), 'sellify-order-pricing-review-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const owner = await store.getOrCreateUserByTelegram('pricing-review-owner', 'Pricing Review Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Pricing Review Test', country: 'ET',
    currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(tenant.chatId, [
    { id: 'catalog-match', name: 'Catalog Match', price: 100, stock: 10 },
    { id: 'catalog-other', name: 'Catalog Other', price: 200, stock: 10 },
  ]);

  const [verifiedResult] = await store.saveQueuedOrders(tenant.chatId, [{
    id: 'catalog-price-match',
    currency: 'ETB',
    items: [{ id: 'catalog-match', name: 'Catalog Match', price: 100, qty: 2, currency: 'ETB' }],
  }]);
  assert.equal(verifiedResult.status, 'synced');
  let orders = await store.getOrders(tenant.chatId);
  let verified = orders.find(order => order.id === 'catalog-price-match');
  assert.equal(verified.pricing_review.status, 'VERIFIED');
  assert.equal(verified.pricing_review.source, 'CATALOG_BASE');
  assert.equal(verified.pricing_review.verification_state, 'SERVER_VERIFIED');
  assert.deepEqual(verified.pricing_review.reason_codes, []);

  const submitted = {
    id: 'manual-price-review',
    currency: 'ETB',
    // Client claim is intentionally untrusted. It must not turn a changed
    // amount into a server-verified pricing decision.
    pricing_decision: { source: 'AUTHORIZED_OVERRIDE', verification_state: 'SERVER_VERIFIED' },
    items: [{ id: 'catalog-match', name: 'Catalog Match', price: 125, qty: 2, currency: 'ETB' }],
  };
  const [reviewRequiredResult] = await store.saveQueuedOrders(tenant.chatId, [submitted]);
  assert.equal(reviewRequiredResult.status, 'synced');
  orders = await store.getOrders(tenant.chatId);
  const reviewRequired = orders.find(order => order.id === 'manual-price-review');
  assert.equal(reviewRequired.total, 250);
  assert.equal(reviewRequired.pricing_review.status, 'REVIEW_REQUIRED');
  assert.equal(reviewRequired.pricing_review.source, 'CLIENT_REPORTED');
  assert.equal(reviewRequired.pricing_review.verification_state, 'REVIEW_REQUIRED');
  assert.deepEqual(reviewRequired.pricing_review.reason_codes, ['CATALOG_PRICE_MISMATCH']);

  assert.equal(reviewRequiredResult.pricing_review_status, 'REVIEW_REQUIRED');

  // Name/phone-based customer inference stores a private retry-identity bit.
  // A review update must preserve it so an exact sync retry remains idempotent.
  const inferredCustomerOrder = {
    id: 'review-preserves-customer-identity', customer_name: 'Buyer Inferred', customer_phone: '+251911000001',
    currency: 'ETB', items: [{ id: 'catalog-match', name: 'Catalog Match', price: 125, qty: 1, currency: 'ETB' }],
  };
  const [inferredCreated] = await store.saveQueuedOrders(tenant.chatId, [inferredCustomerOrder]);
  const inferredStored = (await store.getOrders(tenant.chatId)).find(order => order.id === inferredCustomerOrder.id);
  await store.reviewOrderPricing(tenant.chatId, inferredCreated.order_id, 'ACCEPT_AS_SUBMITTED',
    'Reviewed inferred customer order price and accepted it.', { userId: owner.id });
  const [inferredRetry] = await store.saveQueuedOrders(tenant.chatId, [structuredClone(inferredCustomerOrder)]);
  assert.equal(inferredRetry.status, 'synced');
  assert.equal(inferredRetry.order_id, inferredCreated.order_id);
  assert.equal(inferredStored.customer_id, (await store.getOrders(tenant.chatId)).find(order => order.id === inferredCustomerOrder.id).customer_id);

  await assert.rejects(
    store.transitionOrderFulfillment(tenant.chatId, reviewRequiredResult.order_id, 'out_for_delivery',
      { userId: owner.id }, { idempotencyKey: 'pricing-review-required-fulfillment' }),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'fulfillment must remain blocked until an authorized pricing review decision',
  );
  assert.equal(await store.getOrderFulfillment(tenant.chatId, reviewRequiredResult.order_id), null,
    'blocked fulfillment must not create a fulfillment record');

  const reviewer = { userId: owner.id };
  const decision = await store.reviewOrderPricing(
    tenant.chatId, reviewRequired.server_order_id, 'ACCEPT_AS_SUBMITTED',
    'Manager reviewed the submitted customer price and accepts it.', reviewer,
  );
  assert.equal(decision.pricing_review.status, 'APPROVED');
  assert.equal(decision.pricing_review.verification_state, 'REVIEW_APPROVED');
  assert.equal(decision.pricing_review.reviewed_by, owner.id);

  const replay = await store.reviewOrderPricing(
    tenant.chatId, reviewRequired.server_order_id, 'ACCEPT_AS_SUBMITTED',
    'Manager reviewed the submitted customer price and accepts it.', reviewer,
  );
  assert.equal(replay.replayed, true);
  orders = await store.getOrders(tenant.chatId);
  const approved = orders.find(order => order.id === 'manual-price-review');
  assert.equal(approved.total, 250, 'review must not rewrite the accepted amount');
  assert.equal(approved.items[0].price, 125, 'review must not reprice historical line items');

  await assert.rejects(
    store.reviewOrderPricing(tenant.chatId, reviewRequired.server_order_id, 'REJECT',
      'Conflicting second decision must fail.', reviewer),
    error => error.code === 'ORDER_PRICING_REVIEW_ALREADY_DECIDED',
  );
  await assert.rejects(
    store.reviewOrderPricing(tenant.chatId, reviewRequired.server_order_id, 'ACCEPT_AS_SUBMITTED',
      'Missing reviewer', null),
    error => error.code === 'ORDER_PRICING_REVIEW_ACTOR_REQUIRED',
  );
  await assert.rejects(
    store.reviewOrderPricing(tenant.chatId, reviewRequired.server_order_id, 'ACCEPT_AS_SUBMITTED',
      'short', reviewer),
    error => error.code === 'ORDER_PRICING_REVIEW_REASON_INVALID',
  );

  const [unknownCatalogResult] = await store.saveQueuedOrders(tenant.chatId, [{
    id: 'unknown-catalog-item',
    currency: 'ETB',
    items: [{ id: 'not-in-catalog', name: 'Unknown Item', price: 75, qty: 1, currency: 'ETB' }],
  }]);
  assert.equal(unknownCatalogResult.status, 'synced');
  const unknownCatalog = (await store.getOrders(tenant.chatId)).find(order => order.id === 'unknown-catalog-item');
  assert.equal(unknownCatalog.pricing_review.status, 'REVIEW_REQUIRED');
  assert.deepEqual(unknownCatalog.pricing_review.reason_codes, ['CATALOG_ITEM_NOT_FOUND']);

  const rejectedDecision = await store.reviewOrderPricing(
    tenant.chatId, unknownCatalog.server_order_id, 'REJECT',
    'Submitted price cannot be supported by available catalog evidence.', reviewer,
  );
  assert.equal(rejectedDecision.pricing_review.status, 'REJECTED');
  assert.equal(rejectedDecision.pricing_review.verification_state, 'REVIEW_REJECTED');

  const permissions = getRolePermissions('manager');
  assert.ok(permissions.includes('orders:pricing:review'));
  assert.ok(getRolePermissions('owner').includes('*'));
  assert.ok(!getRolePermissions('cashier').includes('orders:pricing:review'));
  assert.ok(!getRolePermissions('buyer').includes('orders:pricing:review'));
  assert.ok(!getRolePermissions('staff').includes('orders:pricing:review'));

  const syncedPayment = await store.getPayment(tenant.chatId, reviewRequiredResult.payment_id);
  assert.equal(syncedPayment.state, 'UNPAID', 'pricing review must not mutate Payment Core state');
  console.log('PASS: queued order pricing assessment and authorized review regression');
} finally {
  await rm(dir, { recursive: true, force: true });
}
