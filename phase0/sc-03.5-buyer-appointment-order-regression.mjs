import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-sc03-5-buyer-appointments-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const sellerUser = await store.getOrCreateUserByTelegram('sc035-seller-' + suffix, 'SC035 Seller');
  const seller = await store.createTenantForUser({
    userId: sellerUser.id, sellerName: 'SC035 Service Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const otherUser = await store.getOrCreateUserByTelegram('sc035-other-' + suffix, 'SC035 Other');
  const otherSeller = await store.createTenantForUser({
    userId: otherUser.id, sellerName: 'SC035 Other Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });

  await store.saveCatalog(seller.chatId, [{
    id: 'sc035-consultation', name: 'Consultation', price: 25000,
    item_type: 'service', marketplace_listed: true,
  }]);
  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'sc035-buyer-' + suffix, customer_name: 'SC035 Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'sc035-consultation', qty: 1 }],
    idempotency_key: 'sc035-checkout-' + suffix,
  });
  const buyer = 'sc035-buyer-' + suffix;
  const owned = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.ok(owned.orderId, 'buyer-owned marketplace order resolves to canonical seller order');
  assert.equal(owned.serviceLines.length, 1);
  assert.equal(owned.serviceLines[0].item_type, 'service');
  assert.deepEqual(owned.bookings, []);

  await assert.rejects(
    store.getTelegramBuyerServiceBookings(seller.chatId, 'different-buyer', checkout.marketplace_order_id),
    error => error?.statusCode === 404 && error?.code === 'ORDER_NOT_FOUND',
    'another buyer must not discover this order or its appointments',
  );
  await assert.rejects(
    store.getTelegramBuyerServiceBookings(otherSeller.chatId, buyer, checkout.marketplace_order_id),
    error => error?.statusCode === 404 && error?.code === 'ORDER_NOT_FOUND',
    'another seller tenant must not discover this order or its appointments',
  );

  const resource = await store.createServiceResource(seller.chatId, {
    name: 'Customer-facing Consultation Resource',
    resourceType: 'PROVIDER',
    serviceItemId: 'sc035-consultation',
    idempotencyKey: 'sc035-resource-' + suffix,
  }, null);
  // Fixture precondition: service-provider role assignment is valid only when
  // the tenant's canonical Service Pack lifecycle is ACTIVE. Seed that state
  // directly in this isolated test database; production activation remains
  // governed by the Pack lifecycle authority.
  const db = store.getDatabaseForTests();
  const organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(seller.chatId).organization_id;
  const providerUser = await store.getOrCreateUserByTelegram('sc035-provider-' + suffix, 'SC035 Provider');
  const providerMembership = await store.ensureMembership(providerUser.id, seller.chatId, 'staff');
  await assert.rejects(
    store.assignMembershipContextualRole({
      actorUserId: sellerUser.id, chatId: seller.chatId, membershipId: providerMembership.id,
      role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.resource.id,
    }),
    error => error?.statusCode === 409,
    'Service Provider role assignment must remain unavailable until the Service Pack is ACTIVE',
  );
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pack_lifecycle (
    id, organization_id, pack_id, pack_version, state, installed_at, activated_at,
    created_by_user_id, updated_by_user_id, created_at, updated_at, version
  ) VALUES (?, ?, 'service', '1.0.0', 'ACTIVE', ?, ?, ?, ?, ?, ?, 1)`).run(
    'sc035-service-pack-' + suffix, organizationId, now, now,
    sellerUser.id, sellerUser.id, now, now,
  );

  await store.assignMembershipContextualRole({
    actorUserId: sellerUser.id, chatId: seller.chatId, membershipId: providerMembership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.resource.id,
  });
  const providerSession = await store.createSession({
    userId: providerUser.id, chatId: seller.chatId, deviceName: 'SC-03.5 provider regression',
  });
  const activeProviderSession = await store.authenticateSessionToken(providerSession.token);
  assert.ok(activeProviderSession.contextualRoles.some(item =>
    item.role === 'service_provider' && item.scopeType === 'RESOURCE' && item.scopeId === resource.resource.id),
  'authenticated session resolves the currently active resource-scoped provider assignment');

  await store.setServiceResourceAvailability(seller.chatId, resource.resource.id, {
    expectedVersion: 0,
    idempotencyKey: 'sc035-hours-' + suffix,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
      weekday, startTime: '08:00', endTime: '18:00',
    })),
    exceptions: [],
  }, null);

  const start = '2027-01-20T09:00:00+03:00';
  const end = '2027-01-20T10:00:00+03:00';
  const bookingsBeforeAssessment = db.prepare('SELECT COUNT(*) AS count FROM service_bookings').get().count;
  const commitmentsBeforeAssessment = db.prepare('SELECT COUNT(*) AS count FROM service_resource_commitments').get().count;
  const feasible = await store.assessTelegramBuyerServiceFeasibility(seller.chatId, buyer, checkout.marketplace_order_id, {
    service_item_id: 'sc035-consultation', start, end,
  });
  assert.equal(feasible.state, 'FEASIBLE');
  assert.equal(feasible.confirmsAvailability, false);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM service_bookings').get().count, bookingsBeforeAssessment,
    'feasibility must not create a booking');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM service_resource_commitments').get().count, commitmentsBeforeAssessment,
    'feasibility must not reserve or commit a resource');

  // Simulate a pre-SC-03.4 confirmed appointment that has no proven resource
  // binding or commitment. Candidate feasibility must fail closed for overlap.
  const legacyStart = '2027-01-24T09:00:00+03:00';
  const legacyEnd = '2027-01-24T10:00:00+03:00';
  const legacyBooking = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: legacyStart,
    requested_end: legacyEnd,
    appointment_mode: 'REMOTE',
    idempotencyKey: 'sc035-legacy-booking-' + suffix,
  }, null);
  db.prepare(`UPDATE service_bookings
    SET status = 'CONFIRMED', service_resource_id = NULL
    WHERE id = ? AND organization_id = ?`).run(legacyBooking.booking.id, organizationId);
  const legacyAssessment = await store.assessTelegramBuyerServiceFeasibility(
    seller.chatId, buyer, checkout.marketplace_order_id,
    { service_item_id: 'sc035-consultation', start: legacyStart, end: legacyEnd },
  );
  assert.equal(legacyAssessment.state, 'UNKNOWN',
    'overlapping legacy confirmed appointments without a committed resource must not be reported feasible');
  assert.equal(legacyAssessment.reasonCode, 'OVERLAPPING_LEGACY_CONFIRMED_BOOKING_WITHOUT_RESOURCE');

  const created = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: start,
    requested_end: end,
    appointment_mode: 'REMOTE',
    idempotencyKey: 'sc035-booking-' + suffix,
  }, {
    actorType: 'TELEGRAM_BUYER',
    buyerTelegramUserId: buyer,
    marketplaceOrderId: checkout.marketplace_order_id,
  });
  assert.equal(created.booking.status, 'REQUESTED');
  await assert.rejects(
    store.createServiceBooking(seller.chatId, owned.orderId, {
      service_item_id: 'sc035-consultation',
      requested_start: '2027-01-22T09:00:00+03:00',
      requested_end: '2027-01-22T10:00:00+03:00',
      appointment_mode: 'REMOTE',
      idempotencyKey: 'sc035-wrong-buyer-create-' + suffix,
    }, {
      actorType: 'TELEGRAM_BUYER',
      buyerTelegramUserId: 'forged-buyer',
      marketplaceOrderId: checkout.marketplace_order_id,
    }),
    error => error?.code === 'ORDER_NOT_FOUND',
    'booking transaction must recheck the verified buyer-to-order binding',
  );
  assert.equal(created.booking.service_resource_id, null,
    'customer request must not assign or commit a resource');

  const accepted = await store.transitionServiceBooking(seller.chatId, owned.orderId, created.booking.id, {
    status: 'ACCEPTED', expectedVersion: 1, idempotencyKey: 'sc035-accept-' + suffix,
  }, null);
  const confirmed = await store.transitionServiceBooking(seller.chatId, owned.orderId, created.booking.id, {
    status: 'CONFIRMED', expectedVersion: accepted.booking.version,
    service_resource_id: resource.resource.id, idempotencyKey: 'sc035-confirm-' + suffix,
  }, null);
  assert.equal(confirmed.booking.status, 'CONFIRMED');

  const pendingProviderQueue = await store.listServiceProviderBookings(seller.chatId, [resource.resource.id]);
  assert.equal(pendingProviderQueue.length, 1,
    'provider projection includes a confirmed appointment only after its canonical commitment exists');
  assert.equal(pendingProviderQueue[0].id, created.booking.id);

  const secondResource = await store.createServiceResource(seller.chatId, {
    name: 'Second Consultation Provider', resourceType: 'PROVIDER',
    serviceItemId: 'sc035-consultation', idempotencyKey: 'sc035-resource-two-' + suffix,
  }, null);
  await store.setServiceResourceAvailability(seller.chatId, secondResource.resource.id, {
    expectedVersion: 0, idempotencyKey: 'sc035-hours-two-' + suffix,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
      weekday, startTime: '08:00', endTime: '18:00',
    })),
    exceptions: [],
  }, null);
  const secondRequest = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: '2027-01-23T09:00:00+03:00',
    requested_end: '2027-01-23T10:00:00+03:00',
    appointment_mode: 'REMOTE', idempotencyKey: 'sc035-booking-two-' + suffix,
  }, null);
  const secondAccepted = await store.transitionServiceBooking(seller.chatId, owned.orderId, secondRequest.booking.id, {
    status: 'ACCEPTED', expectedVersion: secondRequest.booking.version,
    idempotencyKey: 'sc035-accept-two-' + suffix,
  }, null);
  const secondConfirmed = await store.transitionServiceBooking(seller.chatId, owned.orderId, secondRequest.booking.id, {
    status: 'CONFIRMED', expectedVersion: secondAccepted.booking.version,
    service_resource_id: secondResource.resource.id,
    idempotencyKey: 'sc035-confirm-two-' + suffix,
  }, null);

  const firstProviderQueue = await store.listServiceProviderBookings(seller.chatId, [resource.resource.id]);
  const secondProviderQueue = await store.listServiceProviderBookings(seller.chatId, [secondResource.resource.id]);
  assert.deepEqual(firstProviderQueue.map(item => item.id), [created.booking.id],
    'one provider resource must not see another resource\'s appointment');
  assert.deepEqual(secondProviderQueue.map(item => item.id), [secondRequest.booking.id],
    'the second provider sees only its own committed appointment');

  const foreignResource = await store.createServiceResource(otherSeller.chatId, {
    name: 'Foreign Tenant Provider', resourceType: 'PROVIDER',
    idempotencyKey: 'sc035-foreign-resource-' + suffix,
  }, null);
  assert.deepEqual(await store.listServiceProviderBookings(seller.chatId, [foreignResource.resource.id]), [],
    'a resource identifier from another organization must not expose appointments');

  assert.throws(
    () => store.updateServiceResource(seller.chatId, secondResource.resource.id, {
      expectedVersion: secondResource.resource.version, status: 'INACTIVE',
      idempotencyKey: 'sc035-inactivate-resource-two-active-' + suffix,
    }, null),
    error => error?.code === 'SERVICE_RESOURCE_HAS_ACTIVE_COMMITMENTS',
    'a resource with a confirmed appointment cannot be deactivated and orphan its provider assignment',
  );
  const completedSecondBooking = await store.transitionServiceBooking(seller.chatId, owned.orderId, secondRequest.booking.id, {
    status: 'COMPLETED', expectedVersion: secondConfirmed.booking.version,
    completion_note: 'SC-03.5 regression completion',
    idempotencyKey: 'sc035-complete-two-' + suffix,
  }, null);
  assert.equal(completedSecondBooking.booking.status, 'COMPLETED');
  assert.equal(db.prepare("SELECT state FROM service_resource_commitments WHERE booking_id=?").get(secondRequest.booking.id).state, 'RELEASED',
    'completion releases the resource commitment atomically');
  const inactivatedResource = await store.updateServiceResource(seller.chatId, secondResource.resource.id, {
    expectedVersion: secondResource.resource.version, status: 'INACTIVE',
    idempotencyKey: 'sc035-inactivate-resource-two-' + suffix,
  }, null);
  assert.equal(inactivatedResource.resource.status, 'INACTIVE');
  assert.deepEqual(await store.listServiceProviderBookings(seller.chatId, [secondResource.resource.id]), [],
    'appointments assigned to an inactive resource are excluded from the provider queue');

  await store.revokeMembershipContextualRole({
    actorUserId: sellerUser.id, chatId: seller.chatId, membershipId: providerMembership.id,
    role: 'service_provider', scopeType: 'RESOURCE', scopeId: resource.resource.id,
  });
  const revokedProviderSession = await store.authenticateSessionToken(providerSession.token);
  assert.equal(revokedProviderSession.contextualRoles.some(item =>
    item.role === 'service_provider' && item.scopeType === 'RESOURCE' && item.scopeId === resource.resource.id), false,
  'revoking the provider assignment removes its authority from an already-issued session token');
  const conflict = await store.assessTelegramBuyerServiceFeasibility(seller.chatId, buyer, checkout.marketplace_order_id, {
    service_item_id: 'sc035-consultation', start, end,
  });
  assert.equal(conflict.state, 'CONFLICT',
    'a committed interval must be excluded from subsequent advisory feasibility');
  assert.equal(conflict.reasonCode, 'ALL_MATCHING_RESOURCES_COMMITTED');

  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, owned.orderId, created.booking.id, {
      status: 'CANCELLED',
      expected_version: confirmed.booking.version,
      idempotencyKey: 'sc035-buyer-cancel-confirmed-' + suffix,
    }, {
      actorType: 'TELEGRAM_BUYER',
      buyerTelegramUserId: buyer,
      marketplaceOrderId: checkout.marketplace_order_id,
    }),
    error => error?.code === 'SERVICE_BOOKING_CUSTOMER_CANCELLATION_NOT_ALLOWED',
    'customer cancellation policy must reject confirmed appointments inside the canonical transition transaction',
  );

  const cancellable = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: '2027-01-21T09:00:00+03:00',
    requested_end: '2027-01-21T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    idempotencyKey: 'sc035-cancellable-request-' + suffix,
  }, null);
  const cancelled = await store.transitionServiceBooking(seller.chatId, owned.orderId, cancellable.booking.id, {
    status: 'CANCELLED', expected_version: 1, idempotencyKey: 'sc035-cancel-request-' + suffix,
  }, {
    actorType: 'TELEGRAM_BUYER',
    buyerTelegramUserId: buyer,
    marketplaceOrderId: checkout.marketplace_order_id,
  });
  assert.equal(cancelled.booking.status, 'CANCELLED');
  const cancelledReplay = await store.transitionServiceBooking(seller.chatId, owned.orderId, cancellable.booking.id, {
    status: 'CANCELLED', expected_version: 1, idempotencyKey: 'sc035-cancel-request-' + suffix,
  }, {
    actorType: 'TELEGRAM_BUYER',
    buyerTelegramUserId: buyer,
    marketplaceOrderId: checkout.marketplace_order_id,
  });
  assert.equal(cancelledReplay.replayed, true);
  assert.equal(cancelledReplay.booking.status, 'CANCELLED');

  const after = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.equal(after.bookings.length, 4,
    'buyer projection includes both committed appointments, the legacy confirmed appointment, and the cancelled request');
  assert.ok(after.bookings.some(item => item.id === secondRequest.booking.id),
    'buyer projection retains the second provider appointment after its resource is inactivated');
  const visibleConfirmed = after.bookings.find(item => item.id === created.booking.id);
  const visibleLegacy = after.bookings.find(item => item.id === legacyBooking.booking.id);
  const visibleCancelled = after.bookings.find(item => item.id === cancellable.booking.id);
  assert.equal(visibleConfirmed?.service_resource_name, 'Customer-facing Consultation Resource');
  assert.equal(visibleLegacy?.status, 'CONFIRMED');
  assert.equal(visibleLegacy?.service_resource_name, null,
    'legacy appointments without a proven commitment must not be presented as resource-bound');
  assert.equal(visibleConfirmed?.status, 'CONFIRMED');

  // A commitment row is not sufficient on its own: its resource and interval
  // must still match the canonical booking before either buyer or provider
  // projections describe the appointment as resource-bound.
  const exactCommitment = db.prepare(`
    SELECT id, starts_at FROM service_resource_commitments
    WHERE booking_id=? AND organization_id=? AND chat_id=? AND state='COMMITTED'
  `).get(created.booking.id, organizationId, seller.chatId);
  assert.ok(exactCommitment, 'confirmed appointment has a canonical commitment row');
  db.prepare('UPDATE service_resource_commitments SET starts_at=? WHERE id=?')
    .run('2027-01-20T09:01:00.000Z', exactCommitment.id);
  const mismatchedBuyerProjection = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.equal(mismatchedBuyerProjection.bookings.find(item => item.id === created.booking.id)?.service_resource_name, null,
    'buyer projection must not expose a resource for a mismatched commitment interval');
  assert.deepEqual(await store.listServiceProviderBookings(seller.chatId, [resource.resource.id]).then(rows => rows.filter(item => item.id === created.booking.id)), [],
    'provider queue must exclude a commitment whose interval no longer matches the booking');
  db.prepare('UPDATE service_resource_commitments SET starts_at=? WHERE id=?')
    .run(exactCommitment.starts_at, exactCommitment.id);

  assert.equal(visibleCancelled?.status, 'CANCELLED');
  assert.equal(visibleCancelled?.service_resource_name, null,
    'released or never-committed resources must not be presented as committed');
  await store.transitionServiceBooking(seller.chatId, owned.orderId, created.booking.id, {
    status: 'CANCELLED', expected_version: confirmed.booking.version,
    idempotencyKey: 'sc035-operator-cancel-' + suffix,
  }, null);
  const afterRelease = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.deepEqual(await store.listServiceProviderBookings(seller.chatId, [resource.resource.id]), [],
    'released commitments are immediately excluded from the provider queue');
  assert.equal(afterRelease.bookings.find(item => item.id === created.booking.id)?.service_resource_name, null,
    'customer projection must stop showing a resource after canonical commitment release');
  const feasibleAfterRelease = await store.assessTelegramBuyerServiceFeasibility(seller.chatId, buyer, checkout.marketplace_order_id, {
    service_item_id: 'sc035-consultation', start, end,
  });
  assert.equal(feasibleAfterRelease.state, 'FEASIBLE',
    'released commitment must no longer block advisory feasibility');
  console.log('SC-03.5 buyer-owned appointment order resolution regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
