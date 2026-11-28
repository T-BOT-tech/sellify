import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  const tenantRecord = await store.getTenant(tenant.chatId);
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
  assert.equal(Object.hasOwn(reviewRequired, 'pricing_decision'), false,
    'client-supplied pricing authorization claims must not persist as canonical order evidence');
  assert.equal(reviewRequired.pricing_review.verification_state, 'REVIEW_REQUIRED');
  assert.deepEqual(reviewRequired.pricing_review.reason_codes, ['CATALOG_PRICE_MISMATCH']);
  assert.deepEqual(reviewRequired.pricing_review.line_assessments, [{
    item_id: 'catalog-match', submitted_price_minor: 125, catalog_price_minor: 100,
    result: 'REVIEW_REQUIRED', reason_code: 'CATALOG_PRICE_MISMATCH',
  }]);

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
    'Reviewed inferred customer order price and accepted it.', {
      userId: owner.id, role: 'owner', organizationId: tenantRecord.organizationId, chatId: tenant.chatId,
    });
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

  await assert.rejects(
    store.transitionDeliveryAssignment(tenant.chatId, reviewRequiredResult.order_id, 'DELIVERED',
      { userId: owner.id }, { idempotencyKey: 'pricing-review-required-assignment' }),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'courier assignment lifecycle must remain blocked while pricing review is required',
  );

  const reviewer = { userId: owner.id, role: 'owner', organizationId: tenantRecord.organizationId, chatId: tenant.chatId };
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
  const reviewAuditRows = store.getDatabaseForTests().prepare(
    "SELECT action, metadata_json FROM audit_events WHERE action = 'order.pricing_reviewed' AND entity_id = ?"
  ).all(reviewRequired.server_order_id);
  assert.equal(reviewAuditRows.length, 1, 'review decision and audit record must be atomic and idempotent');
  const reviewAuditMetadata = JSON.parse(reviewAuditRows[0].metadata_json);
  assert.equal(reviewAuditMetadata.decision, 'ACCEPT_AS_SUBMITTED');
  assert.equal(reviewAuditMetadata.reviewerId, owner.id);
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
      'Cashier must not approve manual pricing.', { userId: owner.id, role: 'cashier', organizationId: tenantRecord.organizationId }),
    error => error.code === 'ORDER_PRICING_REVIEW_FORBIDDEN' && error.statusCode === 403,
  );
  await assert.rejects(
    store.reviewOrderPricing(tenant.chatId, reviewRequired.server_order_id, 'ACCEPT_AS_SUBMITTED',
      'short', reviewer),
    error => error.code === 'ORDER_PRICING_REVIEW_REASON_INVALID',
  );

  const [serviceOrderResult] = await store.saveQueuedOrders(tenant.chatId, [{
    id: 'service-price-review-required',
    currency: 'ETB',
    items: [{ id: 'service-unlisted', name: 'Unlisted Service', price: 300, qty: 1, item_type: 'service' }],
  }]);
  const serviceBooking = await store.createServiceBooking(tenant.chatId, serviceOrderResult.order_id, {
    service_item_id: 'service-unlisted',
    requested_start: '2026-12-01T09:00:00+03:00',
    requested_end: '2026-12-01T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    idempotency_key: 'service-booking-price-review-request',
  }, reviewer);
  assert.equal(serviceBooking.booking.status, 'REQUESTED',
    'a service request may be recorded without treating it as authorization to commit');
  const acceptedServiceRequest = await store.transitionServiceBooking(
    tenant.chatId, serviceOrderResult.order_id, serviceBooking.booking.id,
    { status: 'ACCEPTED', expected_version: 1, idempotency_key: 'service-booking-price-review-accept' },
    reviewer,
  );
  assert.equal(acceptedServiceRequest.booking.status, 'ACCEPTED');
  await assert.rejects(
    store.transitionServiceBooking(
      tenant.chatId, serviceOrderResult.order_id, serviceBooking.booking.id,
      { status: 'CONFIRMED', expected_version: 2, service_resource_id: 'unused-resource',
        idempotency_key: 'service-booking-price-review-confirm' },
      reviewer,
    ),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'service booking confirmation must not commit a resource while the order price is unreviewed',
  );

  // Legacy canonical orders can lack the newer pricing_review projection.
  // They must be treated as unassessed, not silently allowed to execute.
  const [legacyExecutionResult] = await store.saveQueuedOrders(tenant.chatId, [{
    id: 'legacy-order-execution-gate',
    currency: 'ETB',
    items: [{ id: 'catalog-match', name: 'Catalog Match', price: 100, qty: 1, currency: 'ETB' }],
  }]);
  const legacyExecutionRow = store.getDatabaseForTests().prepare(
    'SELECT local_id, order_json FROM orders WHERE chat_id = ? AND server_order_id = ?'
  ).get(tenant.chatId, legacyExecutionResult.order_id);
  const legacyExecutionJson = JSON.parse(legacyExecutionRow.order_json);
  delete legacyExecutionJson.pricing_review;
  store.getDatabaseForTests().prepare('UPDATE orders SET order_json = ? WHERE chat_id = ? AND local_id = ?')
    .run(JSON.stringify(legacyExecutionJson), tenant.chatId, legacyExecutionRow.local_id);

  await assert.rejects(
    store.transitionOrderFulfillment(tenant.chatId, legacyExecutionResult.order_id, 'out_for_delivery',
      { userId: owner.id }, { idempotencyKey: 'legacy-pricing-review-fulfillment' }),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'legacy orders without a pricing assessment must not enter fulfillment',
  );
  await assert.rejects(
    store.transitionDeliveryAssignment(tenant.chatId, legacyExecutionResult.order_id, 'DELIVERED',
      { userId: owner.id }, { idempotencyKey: 'legacy-pricing-review-assignment' }),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'legacy orders without a pricing assessment must not enter courier assignment',
  );
  const legacyServiceRequest = await store.createServiceBooking(tenant.chatId, legacyExecutionResult.order_id, {
    service_item_id: 'catalog-match',
    requested_start: '2026-12-01T11:00:00+03:00',
    requested_end: '2026-12-01T12:00:00+03:00',
    appointment_mode: 'REMOTE',
    idempotency_key: 'legacy-pricing-review-booking-request',
  }, reviewer);
  await assert.rejects(
    store.transitionServiceBooking(tenant.chatId, legacyExecutionResult.order_id, legacyServiceRequest.booking.id,
      { status: 'CONFIRMED', expected_version: 1, service_resource_id: 'unused-resource',
        idempotency_key: 'legacy-pricing-review-booking-confirm' }, reviewer),
    error => error.code === 'ORDER_PRICING_REVIEW_REQUIRED' && error.statusCode === 409,
    'legacy orders without a pricing assessment must not confirm service commitments',
  );

  const [forgedMarketplaceResult] = await store.saveQueuedOrders(tenant.chatId, [{
    id: 'client-cannot-claim-marketplace',
    is_marketplace: true,
    marketplace_order_id: 'forged-marketplace-id',
    currency: 'ETB',
    items: [{ id: 'catalog-match', name: 'Catalog Match', price: 100, qty: 1, currency: 'ETB' }],
  }]);
  const forgedMarketplaceOrder = (await store.getOrders(tenant.chatId)).find(order => order.id === 'client-cannot-claim-marketplace');
  assert.equal(forgedMarketplaceOrder.is_marketplace, false);
  assert.equal(forgedMarketplaceOrder.marketplace_order_id, null);

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

  await assert.rejects(
    store.transitionOrderFulfillment(tenant.chatId, unknownCatalog.server_order_id, 'out_for_delivery',
      { userId: owner.id }, { idempotencyKey: 'pricing-review-rejected-fulfillment' }),
    error => error.code === 'ORDER_PRICING_REVIEW_REJECTED' && error.statusCode === 409,
    'a rejected submitted price must remain blocked from fulfillment',
  );

  const permissions = getRolePermissions('manager');
  assert.ok(permissions.includes('orders:pricing:review'));
  assert.ok(getRolePermissions('owner').includes('*'));
  assert.ok(!getRolePermissions('cashier').includes('orders:pricing:review'));
  assert.ok(!getRolePermissions('buyer').includes('orders:pricing:review'));
  assert.ok(!getRolePermissions('staff').includes('orders:pricing:review'));


  const serverSource = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
  assert.ok(serverSource.includes("method: 'PATCH', pattern: /^\\/orders\\/([^/]+)\\/([^/]+)\\/pricing-review$/"));
  assert.ok(serverSource.includes("requireAuthorization(session, tenant, 'orders', 'orders:pricing:review'"));
  assert.ok(serverSource.includes("reviewOrderPricing(chatId, orderId, body.decision, body.reason, session)"));

  const queueSource = await readFile(new URL('../app/src/orders/queue.js', import.meta.url), 'utf8');
  assert.match(queueSource, /Price review required/);
  assert.match(queueSource, /data-order-pricing-review/);
  assert.match(queueSource, /orders:pricing:review/);
  assert.match(queueSource, /\/pricing-review/);
  const clientPermissions = await readFile(new URL('../app/src/auth/permissions.js', import.meta.url), 'utf8');
  assert.match(clientPermissions, /manager:\s*\[[\s\S]*?orders:pricing:review/);
  assert.doesNotMatch(clientPermissions, /cashier:\s*\[[^\]]*orders:pricing:review/);

  const syncedPayment = await store.getPayment(tenant.chatId, reviewRequiredResult.payment_id);
  assert.equal(syncedPayment.state, 'UNPAID', 'pricing review must not mutate Payment Core state');
  console.log('PASS: queued order pricing assessment and authorized review regression');
} finally {
  await rm(dir, { recursive: true, force: true });
}
