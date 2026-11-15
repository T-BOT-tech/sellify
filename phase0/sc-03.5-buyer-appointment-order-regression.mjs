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
  const db = store.getDatabaseForTests();
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

  const created = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: start,
    requested_end: end,
    appointment_mode: 'REMOTE',
    idempotencyKey: 'sc035-booking-' + suffix,
  }, null);
  assert.equal(created.booking.status, 'REQUESTED');
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
    }, { actorType: 'TELEGRAM_BUYER' }),
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
  }, { actorType: 'TELEGRAM_BUYER' });
  assert.equal(cancelled.booking.status, 'CANCELLED');
  const cancelledReplay = await store.transitionServiceBooking(seller.chatId, owned.orderId, cancellable.booking.id, {
    status: 'CANCELLED', expected_version: 1, idempotencyKey: 'sc035-cancel-request-' + suffix,
  }, { actorType: 'TELEGRAM_BUYER' });
  assert.equal(cancelledReplay.replayed, true);
  assert.equal(cancelledReplay.booking.status, 'CANCELLED');

  const after = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.equal(after.bookings.length, 2);
  const visibleConfirmed = after.bookings.find(item => item.id === created.booking.id);
  const visibleCancelled = after.bookings.find(item => item.id === cancellable.booking.id);
  assert.equal(visibleConfirmed?.service_resource_name, 'Customer-facing Consultation Resource');
  assert.equal(visibleConfirmed?.status, 'CONFIRMED');
  assert.equal(visibleCancelled?.status, 'CANCELLED');
  console.log('SC-03.5 buyer-owned appointment order resolution regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
