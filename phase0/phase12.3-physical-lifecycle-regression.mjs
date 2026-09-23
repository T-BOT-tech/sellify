import assert from 'node:assert/strict';

// The fulfillment lifecycle is browser-facing code. Provide the smallest
// browser surface needed to exercise the existing module without replacing it
// with a test-only lifecycle implementation.
const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = globalThis;
globalThis.__APP_CONFIG__ = {};
globalThis.document = {
  getElementById() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() {
    return {
      set textContent(value) { this._textContent = value; },
      get innerHTML() { return this._textContent || ''; },
    };
  },
};

Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });

const state = await import('../app/src/state.js');
const { config, setConfig, setProducts, setOrders, setStockTransactions, setInventoryMovements, setOutboxEvents } = state;
const { setIdbUnavailable } = await import('../app/src/storage/idb.js');
setIdbUnavailable(true);
const { nextFulfillmentStatus, isFulfillmentFinal, advanceFulfillmentOrder } = await import('../app/src/logistics/fulfillment.js');

function resetState() {
  setConfig({
    ...config,
    logisticsEnabled: true,
    warehouseEnabled: true,
    chatId: '',
    sessionToken: '',
  });
  setProducts([]);
  setOrders([]);
  setStockTransactions([]);
  setInventoryMovements([]);
  setOutboxEvents([]);
}

function product(id, stock = 10) {
  return { id, name: `Product ${id}`, price: 100, stock };
}

resetState();

// 1. Delivery lifecycle: pending -> out_for_delivery -> delivered.
const delivery = {
  id: 'ORDER-12.3-DELIVERY',
  fulfillment_type: 'delivery',
  fulfillment_status: 'pending',
  stock_deducted: false,
  items: [{ id: 'P-DELIVERY', qty: 2 }],
};
setProducts([product('P-DELIVERY', 10)]);
setOrders([delivery]);

assert.equal(nextFulfillmentStatus(delivery), 'out_for_delivery');
assert.equal(isFulfillmentFinal(delivery.fulfillment_status), false);
advanceFulfillmentOrder(delivery.id);
assert.equal(delivery.fulfillment_status, 'out_for_delivery');
assert.equal(delivery.stock_deducted, false);
assert.equal(state.products[0].stock, 10);

assert.equal(nextFulfillmentStatus(delivery), 'delivered');
advanceFulfillmentOrder(delivery.id);
assert.equal(delivery.fulfillment_status, 'delivered');
assert.equal(isFulfillmentFinal(delivery.fulfillment_status), true);
assert.equal(delivery.stock_deducted, true);
assert.equal(state.products[0].stock, 8);
assert.equal(state.stockTransactions.length, 1);
assert.equal(state.stockTransactions[0].type, 'sold');
assert.equal(state.stockTransactions[0].quantity, -2);
assert.equal(state.inventoryMovements.length, 1);
assert.equal(state.inventoryMovements[0].movementType, 'SALE');
assert.equal(state.inventoryMovements[0].referenceType, 'order');
assert.equal(state.inventoryMovements[0].referenceId, delivery.id);

// 2. Final-state idempotency: advancing a delivered order is a no-op.
const deliveryStockAfterFinal = state.products[0].stock;
const deliveryTransactionsAfterFinal = state.stockTransactions.length;
const deliveryMovementsAfterFinal = state.inventoryMovements.length;
advanceFulfillmentOrder(delivery.id);
assert.equal(delivery.fulfillment_status, 'delivered');
assert.equal(delivery.stock_deducted, true);
assert.equal(state.products[0].stock, deliveryStockAfterFinal);
assert.equal(state.stockTransactions.length, deliveryTransactionsAfterFinal);
assert.equal(state.inventoryMovements.length, deliveryMovementsAfterFinal);

// 3. Pickup lifecycle: pending -> ready_for_pickup -> picked_up.
resetState();
const pickup = {
  id: 'ORDER-12.3-PICKUP',
  fulfillment_type: 'pickup',
  fulfillment_status: 'pending',
  stock_deducted: false,
  items: [{ id: 'P-PICKUP', qty: 3 }],
};
setProducts([product('P-PICKUP', 10)]);
setOrders([pickup]);

assert.equal(nextFulfillmentStatus(pickup), 'ready_for_pickup');
advanceFulfillmentOrder(pickup.id);
assert.equal(pickup.fulfillment_status, 'ready_for_pickup');
assert.equal(pickup.stock_deducted, false);
assert.equal(state.products[0].stock, 10);

assert.equal(nextFulfillmentStatus(pickup), 'picked_up');
advanceFulfillmentOrder(pickup.id);
assert.equal(pickup.fulfillment_status, 'picked_up');
assert.equal(isFulfillmentFinal(pickup.fulfillment_status), true);
assert.equal(pickup.stock_deducted, true);
assert.equal(state.products[0].stock, 7);
assert.equal(state.stockTransactions.length, 1);
assert.equal(state.stockTransactions[0].quantity, -3);
assert.equal(state.inventoryMovements.length, 1);
assert.equal(state.inventoryMovements[0].movementType, 'SALE');

// 4. Duplicate/final transition protection: the second final call cannot
// create another stock movement or move beyond the terminal state.
advanceFulfillmentOrder(pickup.id);
assert.equal(pickup.fulfillment_status, 'picked_up');
assert.equal(state.products[0].stock, 7);
assert.equal(state.stockTransactions.length, 1);
assert.equal(state.inventoryMovements.length, 1);

// 5. Invalid transition states are rejected by the existing state machine.
const invalidOrders = [
  { id: 'INVALID-TYPE', fulfillment_type: 'shipping', fulfillment_status: 'pending' },
  { id: 'INVALID-STATUS', fulfillment_type: 'delivery', fulfillment_status: 'ready_for_pickup' },
  { id: 'FINAL-DELIVERY', fulfillment_type: 'delivery', fulfillment_status: 'delivered' },
  { id: 'FINAL-PICKUP', fulfillment_type: 'pickup', fulfillment_status: 'picked_up' },
];
for (const order of invalidOrders) {
  assert.equal(nextFulfillmentStatus(order), null);
}

const invalidOrder = { id: 'INVALID-ADVANCE', fulfillment_type: 'delivery', fulfillment_status: 'ready_for_pickup', stock_deducted: false };
setOrders([invalidOrder]);
advanceFulfillmentOrder(invalidOrder.id);
assert.equal(invalidOrder.fulfillment_status, 'ready_for_pickup');
assert.equal(invalidOrder.stock_deducted, false);
assert.equal(state.products[0].stock, 7);
assert.equal(state.stockTransactions.length, 1);
assert.equal(state.inventoryMovements.length, 1);

console.log('Phase 12.3 Physical Lifecycle Regression: PASS');
