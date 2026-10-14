import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Connected backend regression for the merchant's first mixed physical/service sale.
// This intentionally reuses canonical catalog, order-sync, inventory and fulfillment
// authorities rather than duplicating their implementation in a test helper.
const dataDir = await mkdtemp(join(tmpdir(), 'sellify-first-sale-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = join(dataDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const chatId = 'fux59-first-sale';
  await store.getOrCreateTenant(chatId);

  // 1. Create one stocked physical item and one service through canonical catalog persistence.
  await store.saveCatalog(chatId, [
    { id: 'fux59-physical', name: 'Coffee beans', price: 120, stock: 5, type: 'product' },
    { id: 'fux59-service', name: 'Barista training', price: 900, type: 'service' },
  ]);

  // 2. Read back the persisted catalog, as the app does after a reload/hydration.
  const hydrated = await store.getCatalog(chatId);
  assert.equal(hydrated.products.find(item => item.id === 'fux59-physical')?.type, 'product');
  assert.equal(hydrated.products.find(item => item.id === 'fux59-service')?.type, 'service');

  let balances = await store.getInventoryBalances(chatId);
  assert.equal(balances.find(row => row.productId === 'fux59-physical')?.quantity, 5,
    'the physical catalog opening balance is represented in canonical inventory');
  assert.equal(balances.find(row => row.productId === 'fux59-service'), undefined,
    'services never receive a canonical inventory balance');

  // 3. Sync a mixed sale. Client item types are deliberately misleading:
  // persisted catalog identity, not the client payload, decides stock behavior.
  const localOrder = {
    id: 'local-fux59-first-sale',
    currency: 'ETB',
    customer_name: 'First Sale Buyer',
    items: [
      { id: 'fux59-physical', name: 'Coffee beans', qty: 2, price: 120, type: 'service' },
      { id: 'fux59-service', name: 'Barista training', qty: 1, price: 900, type: 'product' },
    ],
    fulfillment_type: 'delivery',
    delivery_address: 'Addis Ababa',
  };
  const firstSync = await store.saveQueuedOrders(chatId, [localOrder]);
  assert.equal(firstSync[0]?.status, 'synced');
  assert.ok(firstSync[0]?.order_id, 'sync acknowledgement contains canonical server order ID');
  const serverOrderId = firstSync[0].order_id;

  const persistedOrders = await store.getOrders(chatId);
  const persistedOrder = persistedOrders.find(order => order.server_order_id === serverOrderId);
  assert.ok(persistedOrder, 'canonical order is persisted and readable');
  assert.equal(persistedOrder.items.length, 2, 'both physical and service lines survive sync');
  assert.equal(persistedOrder.total, 1140, 'canonical order total is calculated from validated line items');

  // 4. Retrying the same local order returns the same canonical order, not a duplicate.
  const retry = await store.saveQueuedOrders(chatId, [structuredClone(localOrder)]);
  assert.equal(retry[0]?.status, 'synced');
  assert.equal(retry[0]?.order_id, serverOrderId);
  assert.equal((await store.getOrders(chatId)).filter(order => order.server_order_id === serverOrderId).length, 1);

  // 5. Fulfill through the canonical server transition boundary. Replaying the
  // same command key must not apply a second stock deduction.
  const actor = { userId: 'fux59-owner', deviceId: 'fux59-device', locationId: null };
  const dispatched = await store.transitionOrderFulfillment(chatId, serverOrderId, 'out_for_delivery', actor, {
    idempotencyKey: 'fux59-dispatch',
  });
  assert.equal(dispatched.status, 'out_for_delivery');

  const delivered = await store.transitionOrderFulfillment(chatId, serverOrderId, 'delivered', actor, {
    idempotencyKey: 'fux59-deliver',
    proof: { type: 'reference', ref: 'fux59-proof' },
  });
  assert.equal(delivered.status, 'delivered');

  const deliveredReplay = await store.transitionOrderFulfillment(chatId, serverOrderId, 'delivered', actor, {
    idempotencyKey: 'fux59-deliver',
    proof: { type: 'reference', ref: 'fux59-proof' },
  });
  assert.equal(deliveredReplay.id, delivered.id);
  assert.equal(deliveredReplay.status, 'delivered');

  // 6. Only the canonical physical item is deducted; service quantity is never stock.
  balances = await store.getInventoryBalances(chatId);
  assert.equal(balances.find(row => row.productId === 'fux59-physical')?.quantity, 3,
    'fulfillment deducts the physical quantity exactly once');
  assert.equal(balances.find(row => row.productId === 'fux59-service'), undefined,
    'fulfillment never creates service inventory, even with a forged client item type');

  console.log('FUX-59 First-Sale Connected Integration Regression: PASS');
  console.log('Catalog persistence/hydration -> mixed order sync -> canonical order ID: PASS');
  console.log('Order retry and fulfillment replay idempotency: PASS');
  console.log('Canonical physical stock deduction; service inventory exclusion: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
