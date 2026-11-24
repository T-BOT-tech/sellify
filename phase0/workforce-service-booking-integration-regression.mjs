import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-workforce-booking-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('workforce-booking-owner-' + suffix, 'Workforce Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Workforce Booking Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const providerB = await store.getOrCreateUserByTelegram('workforce-booking-provider-b-' + suffix, 'Provider B');
  await store.ensureMembership(providerB.id, seller.chatId, 'staff');

  await store.saveCatalog(seller.chatId, [{
    id: 'workforce-consultation', name: 'Workforce Consultation', price: 25000,
    item_type: 'service', marketplace_listed: true,
  }]);
  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'workforce-booking-buyer-' + suffix,
    customer_name: 'Workforce Booking Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'workforce-consultation', qty: 1 }],
    idempotency_key: 'workforce-booking-checkout-' + suffix,
  });
  assert.ok(checkout.marketplace_order_id);
  const order = (await store.getOrders(seller.chatId)).find(item =>
    item.is_marketplace && item.items?.some(line => line.item_id === 'workforce-consultation'));
  assert.ok(order?.server_order_id);

  const resourceResult = await store.createServiceResource(seller.chatId, {
    name: 'Workforce Consultation Resource',
    resourceType: 'PROVIDER',
    serviceItemId: 'workforce-consultation',
    idempotency_key: 'workforce-booking-resource-' + suffix,
  }, { userId: owner.id });
  const resource = resourceResult.resource;
  await store.setServiceResourceAvailability(seller.chatId, resource.id, {
    expected_version: 0,
    idempotency_key: 'workforce-booking-resource-hours-' + suffix,
    workingHours: [0,1,2,3,4,5,6].map(weekday => ({ weekday, startTime: '08:00', endTime: '18:00' })),
    exceptions: [],
  }, { userId: owner.id });

  const repository = store.createWorkforceSqliteRepository();
  const ownerActor = {
    userId: owner.id, chatId: seller.chatId, organizationId: seller.organizationId,
    role: 'owner', contextualRoles: [],
  };
  const repositoryContext = {
    organization_id: seller.organizationId,
    tenant_id: seller.id,
    chat_id: seller.chatId,
    actor: ownerActor,
    actor_id: owner.id,
  };

  async function createActiveMember(userId, label, key) {
    const memberResult = repository.create('member', {
      idempotency_key: `workforce-member-${key}-${suffix}`,
      user_id: userId,
      member_type: 'PROVIDER',
      display_name: label,
      primary_location_id: resource.locationId || null,
      timezone: 'Africa/Addis_Ababa',
    }, repositoryContext);
    const member = repository.activate('member', memberResult.record.id, {
      expected_version: memberResult.record.version,
    }, repositoryContext);
    const assignmentResult = repository.create('assignment', {
      idempotency_key: `workforce-assignment-${key}-${suffix}`,
      member_id: member.id,
      resource_id: resource.id,
      location_id: resource.locationId || null,
      assignment_type: 'RESOURCE',
      starts_at: '2026-11-26T06:00:00.000Z',
      ends_at: '2026-11-26T15:00:00.000Z',
    }, repositoryContext);
    repository.activate('assignment', assignmentResult.record.id, {
      expected_version: assignmentResult.record.version,
    }, repositoryContext);
    repository.create('availability', {
      idempotency_key: `workforce-availability-${key}-${suffix}`,
      member_id: member.id,
      resource_id: resource.id,
      location_id: resource.locationId || null,
      availability: 'AVAILABLE',
      starts_at: '2026-11-26T06:00:00.000Z',
      ends_at: '2026-11-26T15:00:00.000Z',
      timezone: 'Africa/Addis_Ababa',
      effective_from: '2026-11-26T06:00:00.000Z',
    }, repositoryContext);
    return member;
  }

  const memberA = await createActiveMember(owner.id, 'Provider A', 'a');
  const memberB = await createActiveMember(providerB.id, 'Provider B', 'b');

  async function createAcceptedBooking(label, start, end) {
    const created = await store.createServiceBooking(seller.chatId, order.server_order_id, {
      service_item_id: 'workforce-consultation',
      requested_start: start,
      requested_end: end,
      appointment_mode: 'REMOTE',
      idempotency_key: `workforce-booking-create-${label}-${suffix}`,
    }, ownerActor);
    const accepted = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'ACCEPTED', expected_version: created.booking.version,
      idempotency_key: `workforce-booking-accept-${label}-${suffix}`,
    }, ownerActor);
    return accepted.booking;
  }

  const bookingA = await createAcceptedBooking('a', '2026-11-26T10:00:00+03:00', '2026-11-26T11:00:00+03:00');
  await assert.rejects(
    store.createServiceBooking(seller.chatId, order.server_order_id, {
      service_item_id: 'workforce-consultation',
      requested_start: '2026-11-26T10:00:00+03:00',
      requested_end: '2026-11-26T11:00:00+03:00',
      workforce_member_id: memberA.id,
      idempotency_key: `workforce-member-create-forbidden-${suffix}`,
    }, ownerActor),
    error => error?.code === 'SERVICE_BOOKING_WORKFORCE_MEMBER_CONFIRM_ONLY',
  );

  const confirmedA = await store.transitionServiceBooking(seller.chatId, order.server_order_id, bookingA.id, {
    status: 'CONFIRMED',
    expected_version: bookingA.version,
    service_resource_id: resource.id,
    workforce_member_id: memberA.id,
    idempotency_key: `workforce-booking-confirm-a-${suffix}`,
  }, ownerActor);
  assert.equal(confirmedA.booking.workforce_member_id, memberA.id);
  const commitmentA = store.getDatabaseForTests().prepare(
    "SELECT * FROM service_resource_commitments WHERE booking_id = ? AND state = 'COMMITTED'"
  ).get(bookingA.id);
  assert.equal(commitmentA.resource_id, resource.id);

  const bookingB = await createAcceptedBooking('b', '2026-11-26T12:00:00+03:00', '2026-11-26T13:00:00+03:00');
  const confirmedB = await store.transitionServiceBooking(seller.chatId, order.server_order_id, bookingB.id, {
    status: 'CONFIRMED',
    expected_version: bookingB.version,
    service_resource_id: resource.id,
    workforce_member_id: memberB.id,
    idempotency_key: `workforce-booking-confirm-b-${suffix}`,
  }, ownerActor);
  assert.equal(confirmedB.booking.workforce_member_id, memberB.id);

  const providerABookings = await store.listServiceProviderBookings(seller.chatId, [resource.id], owner.id);
  const providerBBookings = await store.listServiceProviderBookings(seller.chatId, [resource.id], providerB.id);
  assert.deepEqual(providerABookings.map(item => item.id), [bookingA.id]);
  assert.deepEqual(providerBBookings.map(item => item.id), [bookingB.id]);

  const changedMemberAttempt = await createAcceptedBooking('replay', '2026-11-26T14:00:00+03:00', '2026-11-26T15:00:00+03:00');
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, changedMemberAttempt.id, {
      status: 'CONFIRMED', expected_version: changedMemberAttempt.version,
      service_resource_id: resource.id, workforce_member_id: 'missing-member',
      idempotency_key: `workforce-booking-ineligible-${suffix}`,
    }, ownerActor),
    error => error?.code === 'SERVICE_BOOKING_WORKFORCE_MEMBER_INELIGIBLE',
  );
  assert.equal(store.getDatabaseForTests().prepare(
    'SELECT COUNT(*) AS count FROM service_resource_commitments WHERE booking_id = ?'
  ).get(changedMemberAttempt.id).count, 0);

  console.log('PASS Workforce Service Booking integration: eligibility, canonical resource commitment, linkage, and provider appointment isolation');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
