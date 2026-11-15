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

  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const created = await store.createServiceBooking(seller.chatId, owned.orderId, {
    service_item_id: 'sc035-consultation',
    requested_start: start.toISOString(),
    requested_end: end.toISOString(),
    appointment_mode: 'REMOTE',
    idempotencyKey: 'sc035-booking-' + suffix,
  }, null);
  assert.equal(created.booking.status, 'REQUESTED');
  const after = await store.getTelegramBuyerServiceBookings(seller.chatId, buyer, checkout.marketplace_order_id);
  assert.equal(after.bookings.length, 1);
  assert.equal(after.bookings[0].id, created.booking.id);
  assert.equal(after.bookings[0].service_resource_id, null,
    'customer request must not assign or commit a resource');
  console.log('SC-03.5 buyer-owned appointment order resolution regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
