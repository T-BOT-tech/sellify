import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-booking-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('booking-owner-' + suffix, 'Booking Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Booking Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [{
    id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service', marketplace_listed: true,
  }]);
  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'booking-buyer-' + suffix, customer_name: 'Booking Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'consultation', qty: 1 }],
    idempotency_key: 'booking-checkout-' + suffix,
  });
  assert.ok(checkout.marketplace_order_id);
  const order = (await store.getOrders(seller.chatId)).find(item =>
    item.is_marketplace && item.items?.some(line => line.item_id === 'consultation'));
  assert.ok(order?.server_order_id, 'service booking must link to the canonical seller order');

  const request = {
    service_item_id: 'consultation',
    requested_start: '2026-11-01T09:00:00+03:00',
    requested_end: '2026-11-01T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    customer_note: 'Please call first.',
    idempotency_key: 'booking-create-' + suffix,
  };
  const created = await store.createServiceBooking(seller.chatId, order.server_order_id, request, { userId: owner.id });
  assert.equal(created.replayed, false);
  assert.equal(created.booking.status, 'REQUESTED');
  assert.equal(created.booking.version, 1);
  assert.equal(created.booking.requested_start, '2026-11-01T06:00:00.000Z');

  const replay = await store.createServiceBooking(seller.chatId, order.server_order_id, request, { userId: owner.id });
  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.id, created.booking.id);
  await assert.rejects(
    store.createServiceBooking(seller.chatId, order.server_order_id, {
      ...request, requested_end: '2026-11-01T11:00:00+03:00',
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_IDEMPOTENCY_CONFLICT',
  );

  const accepted = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-accept-' + suffix,
  }, { userId: owner.id });
  assert.equal(accepted.booking.status, 'ACCEPTED');
  assert.equal(accepted.booking.version, 2);
  const acceptedReplay = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'booking-accept-' + suffix,
  }, { userId: owner.id });
  assert.equal(acceptedReplay.replayed, true);
  assert.equal(acceptedReplay.booking.status, 'ACCEPTED');

  const confirmed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'CONFIRMED', expected_version: 2, idempotency_key: 'booking-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(confirmed.booking.version, 3);
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'IN_PROGRESS', expected_version: 2, idempotency_key: 'booking-stale-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_VERSION_CONFLICT',
  );
  await assert.rejects(
    store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'REQUESTED', expected_version: 3, idempotency_key: 'booking-invalid-' + suffix,
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_BOOKING_TRANSITION_INVALID',
  );

  const listed = await store.listServiceBookings(seller.chatId, order.server_order_id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.booking.id);

  const secondUser = await store.getOrCreateUserByTelegram('booking-other-' + suffix, 'Other Seller');
  const secondSeller = await store.createTenantForUser({
    userId: secondUser.id, sellerName: 'Other Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await assert.rejects(
    store.transitionServiceBooking(secondSeller.chatId, order.server_order_id, created.booking.id, {
      status: 'IN_PROGRESS', expected_version: 3, idempotency_key: 'cross-tenant-' + suffix,
    }, { userId: secondUser.id }),
    error => error?.code === 'SERVICE_BOOKING_NOT_FOUND' || error?.code === 'ORDER_ORGANIZATION_REQUIRED',
  );

  const db = store.getDatabaseForTests();
  const audit = db.prepare("SELECT action FROM audit_events WHERE entity_type = 'service_booking' AND entity_id = ? ORDER BY id").all(created.booking.id);
  assert.deepEqual(audit.map(row => row.action), [
    'services.booking.requested', 'services.booking.accepted', 'services.booking.confirmed',
  ], 'booking mutations and audit evidence must be committed together');

  console.log('Service Booking Persistence Regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
