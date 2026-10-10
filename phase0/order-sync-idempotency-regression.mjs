import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-order-idempotency-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('order-idempotency-user', 'Order Idempotency');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Order Idempotency Test',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });

  const original = {
    id: 'local-order-100',
    currency: 'ETB',
    customer_name: 'Test Buyer',
    customer_phone: '+251900000000',
    items: [
      { id: 'coffee', name: 'Coffee', price: 100, qty: 2, currency: 'ETB' },
    ],
  };

  const first = await store.saveQueuedOrders(tenant.chatId, [original]);
  assert.equal(first.length, 1);
  assert.equal(first[0].status, 'synced');
  assert.ok(first[0].order_id);
  assert.ok(first[0].payment_id);

  const paymentsAfterFirst = await store.listPayments(tenant.chatId);
  const ordersAfterFirst = await store.getOrders(tenant.chatId);
  assert.equal(ordersAfterFirst.filter(order => order.id === original.id).length, 1);

  const exactRetry = await store.saveQueuedOrders(tenant.chatId, [structuredClone(original)]);
  assert.equal(exactRetry[0].status, 'synced');
  assert.equal(exactRetry[0].order_id, first[0].order_id);
  assert.equal(exactRetry[0].payment_id, first[0].payment_id);

  const changedItems = {
    ...structuredClone(original),
    items: [{ id: 'tea', name: 'Tea', price: 125, qty: 2, currency: 'ETB' }],
  };
  const itemConflict = await store.saveQueuedOrders(tenant.chatId, [changedItems]);
  assert.equal(itemConflict[0].status, 'rejected');
  assert.equal(itemConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const changedQuantity = {
    ...structuredClone(original),
    items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 3, currency: 'ETB' }],
  };
  const quantityConflict = await store.saveQueuedOrders(tenant.chatId, [changedQuantity]);
  assert.equal(quantityConflict[0].status, 'rejected');
  assert.equal(quantityConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const changedCurrency = { ...structuredClone(original), currency: 'USD' };
  const currencyConflict = await store.saveQueuedOrders(tenant.chatId, [changedCurrency]);
  assert.equal(currencyConflict[0].status, 'rejected');
  assert.equal(currencyConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const ordersAfterRetries = await store.getOrders(tenant.chatId);
  const paymentsAfterRetries = await store.listPayments(tenant.chatId);
  assert.equal(ordersAfterRetries.filter(order => order.id === original.id).length, 1);
  assert.equal(ordersAfterRetries.find(order => order.id === original.id).server_order_id, first[0].order_id);
  assert.equal(paymentsAfterRetries.length, paymentsAfterFirst.length);
  assert.equal(paymentsAfterRetries.some(payment => payment.id === first[0].payment_id), true);

  console.log('Order sync idempotency regression: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
