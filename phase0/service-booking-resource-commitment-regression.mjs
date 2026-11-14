import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-resource-commitment-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('resource-commit-owner-' + suffix, 'Resource Commit Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Resource Commit Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [{
    id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service', marketplace_listed: true,
  }]);
  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'resource-commit-buyer-' + suffix, customer_name: 'Resource Commit Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'consultation', qty: 1 }],
    idempotency_key: 'resource-commit-checkout-' + suffix,
  });
  assert.ok(checkout.marketplace_order_id);
  const order = (await store.getOrders(seller.chatId)).find(item =>
    item.is_marketplace && item.items?.some(line => line.item_id === 'consultation'));
  assert.ok(order?.server_order_id);

  const resourceResult = await store.createServiceResource(seller.chatId, {
    name: 'Primary Consultation Provider', resource_type: 'PROVIDER',
    service_item_id: 'consultation', idempotency_key: 'resource-primary-' + suffix,
  }, { userId: owner.id });
  const resource = resourceResult.resource;
  const workingHours = Array.from({ length: 7 }, (_, weekday) => ({
    weekday, start_time: '08:00', end_time: '18:00',
  }));
  await store.setServiceResourceAvailability(seller.chatId, resource.id, {
    working_hours: workingHours, exceptions: [], expected_version: 0,
    idempotency_key: 'resource-primary-hours-' + suffix,
  }, { userId: owner.id });
  const resourceProjection = (await store.listServiceResources(seller.chatId)).find(item => item.id === resource.id);
  assert.equal(resourceProjection?.availabilityConfigured, true, 'resource list must expose declared schedule readiness to the booking UI');

  async function createAccepted(label, start, end, appointmentMode = 'REMOTE') {
    const created = await store.createServiceBooking(seller.chatId, order.server_order_id, {
      service_item_id: 'consultation',
      requested_start: start,
      requested_end: end,
      appointment_mode: appointmentMode,
      idempotency_key: 'booking-create-' + label + '-' + suffix,
    }, { userId: owner.id });
    const accepted = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'ACCEPTED', expected_version: 1,
      idempotency_key: 'booking-accept-' + label + '-' + suffix,
    }, { userId: owner.id });
    return accepted.booking;
  }

  async function confirm(booking, label, resourceId = resource.id) {
    return store.transitionServiceBooking(seller.chatId, order.server_order_id, booking.id, {
      status: 'CONFIRMED', expected_version: booking.version,
      service_resource_id: resourceId,
      idempotency_key: 'booking-confirm-' + label + '-' + suffix,
    }, { userId: owner.id });
  }

  // A booking is not a resource commitment until confirmation explicitly binds
  // it to an active resource with a declared working window.
  const first = await createAccepted('first', '2026-11-01T09:00:00+03:00', '2026-11-01T10:00:00+03:00');
  assert.equal(first.resource_commitment_state, 'NOT_COMMITTED');
  const firstConfirmed = await confirm(first, 'first');
  assert.equal(firstConfirmed.booking.status, 'CONFIRMED');
  assert.equal(firstConfirmed.booking.service_resource_id, resource.id);
  assert.equal(firstConfirmed.booking.resource_commitment_state, 'COMMITTED');
  const replay = await confirm(first, 'first');
  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.resource_commitment_state, 'COMMITTED');
  await assert.rejects(confirm(first, 'first', 'different-resource'),
    error => error?.code === 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT');

  // Overlapping confirmation is rejected inside the same transaction and
  // leaves the second booking ACCEPTED with no resource commitment.
  const overlapping = await createAccepted('overlap', '2026-11-01T09:30:00+03:00', '2026-11-01T10:30:00+03:00');
  await assert.rejects(confirm(overlapping, 'overlap'),
    error => error?.code === 'SERVICE_RESOURCE_SLOT_CONFLICT');
  const overlapState = (await store.listServiceBookings(seller.chatId, order.server_order_id))
    .find(item => item.id === overlapping.id);
  assert.equal(overlapState.status, 'ACCEPTED');
  assert.equal(overlapState.service_resource_id, null);
  assert.equal(overlapState.version, 2);

  // A resource with no availability declaration is UNKNOWN, not available.
  const unscheduledResult = await store.createServiceResource(seller.chatId, {
    name: 'Unscheduled Provider', resource_type: 'PROVIDER',
    service_item_id: 'consultation', idempotency_key: 'resource-unscheduled-' + suffix,
  }, { userId: owner.id });
  const unscheduledProjection = (await store.listServiceResources(seller.chatId)).find(item => item.id === unscheduledResult.resource.id);
  assert.equal(unscheduledProjection?.availabilityConfigured, false, 'resource without a schedule is not eligible for booking selection');
  const unscheduledBooking = await createAccepted('unscheduled', '2026-11-01T12:00:00+03:00', '2026-11-01T13:00:00+03:00');
  await assert.rejects(confirm(unscheduledBooking, 'unscheduled', unscheduledResult.resource.id),
    error => error?.code === 'SERVICE_RESOURCE_AVAILABILITY_UNKNOWN');

  // A declaration is a necessary schedule check, not permission to book
  // outside the declared interval.
  const outsideHours = await createAccepted('outside', '2026-11-01T19:00:00+03:00', '2026-11-01T20:00:00+03:00');
  await assert.rejects(confirm(outsideHours, 'outside'),
    error => error?.code === 'SERVICE_RESOURCE_OUTSIDE_DECLARED_HOURS');

  // Existing pre-migration confirmed bookings with no resource binding are
  // UNKNOWN commitments and block overlapping new confirmations fail-closed.
  const legacy = await createAccepted('legacy', '2026-11-01T14:00:00+03:00', '2026-11-01T15:00:00+03:00');
  const db = store.getDatabaseForTests();
  db.prepare("UPDATE service_bookings SET status='CONFIRMED', version=3, service_resource_id=NULL WHERE id=?")
    .run(legacy.id);
  const legacyProjection = (await store.listServiceBookings(seller.chatId, order.server_order_id))
    .find(item => item.id === legacy.id);
  assert.equal(legacyProjection.resource_commitment_state, 'UNKNOWN');
  const legacyOverlap = await createAccepted('legacy-overlap', '2026-11-01T14:30:00+03:00', '2026-11-01T15:30:00+03:00');
  await assert.rejects(confirm(legacyOverlap, 'legacy-overlap'),
    error => error?.code === 'SERVICE_RESOURCE_LEGACY_COMMITMENT_UNKNOWN');

  // BEGIN IMMEDIATE serializes two competing confirmation commands. Exactly
  // one can claim the same resource/time interval.
  const concurrentA = await createAccepted('concurrent-a', '2026-11-01T11:00:00+03:00', '2026-11-01T12:00:00+03:00');
  const concurrentB = await createAccepted('concurrent-b', '2026-11-01T11:00:00+03:00', '2026-11-01T12:00:00+03:00');
  const concurrent = await Promise.allSettled([
    confirm(concurrentA, 'concurrent-a'),
    confirm(concurrentB, 'concurrent-b'),
  ]);
  assert.equal(concurrent.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter(item => item.status === 'rejected' && item.reason?.code === 'SERVICE_RESOURCE_SLOT_CONFLICT').length, 1);
  const concurrentRows = await store.listServiceBookings(seller.chatId, order.server_order_id);
  const committed = concurrentRows.filter(item =>
    [concurrentA.id, concurrentB.id].includes(item.id) && item.resource_commitment_state === 'COMMITTED');
  assert.equal(committed.length, 1);

  // Cancellation releases the resource interval; a new booking can then claim it.
  const winner = committed[0];
  const cancelled = await store.transitionServiceBooking(seller.chatId, order.server_order_id, winner.id, {
    status: 'CANCELLED', expected_version: 3,
    idempotency_key: 'booking-cancel-concurrent-' + suffix,
  }, { userId: owner.id });
  assert.equal(cancelled.booking.resource_commitment_state, 'RELEASED');
  const replacement = await createAccepted('replacement', '2026-11-01T11:00:00+03:00', '2026-11-01T12:00:00+03:00');
  const replacementConfirmed = await confirm(replacement, 'replacement');
  assert.equal(replacementConfirmed.booking.resource_commitment_state, 'COMMITTED');

  // Service Booking commitment remains inside the Service Booking authority.
  // It does not create Logistics Scheduling activity or mutate Order/Payment.
  const logisticsRows = db.prepare(
    'SELECT id FROM logistics_scheduling_activities WHERE organization_id=? AND related_order_id=?'
  ).all(String(seller.organizationId), String(order.server_order_id));
  assert.equal(logisticsRows.length, 0);
  const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version);
  assert.ok(migrations.includes(80), 'resource commitment migration 80 must be applied');
  const resourceColumn = db.prepare('PRAGMA table_info(service_bookings)').all().some(column => column.name === 'service_resource_id');
  assert.equal(resourceColumn, true);

  console.log('Service Booking Resource Commitment Regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
