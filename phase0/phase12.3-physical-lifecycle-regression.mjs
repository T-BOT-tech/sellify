import assert from 'node:assert/strict';

// Exercise the production fulfillment client against a canonical API response.
// Inventory consequences belong to backend Core Fulfillment, not this UI projection.
const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.location = { origin: 'http://sellify.test' };
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
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });

const state = await import('../app/src/state.js');
const { config, setConfig, setProducts, setOrders, setStockTransactions, setInventoryMovements } = state;
const { nextFulfillmentStatus, isFulfillmentFinal, advanceFulfillmentOrder } = await import('../app/src/logistics/fulfillment.js');

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : {};
  calls.push({ url: String(url), method: options.method || 'GET', body, headers: options.headers || {} });
  if ((options.method || 'GET') !== 'POST') throw new Error('Unexpected fulfillment request method');
  return {
    ok: true,
    status: 200,
    async json() {
      return { fulfillment: { status: body.status, fulfillment_type: body.status.includes('pickup') || body.status === 'picked_up' ? 'pickup' : 'delivery' } };
    },
  };
};

setConfig({
  ...config,
  logisticsEnabled: true,
  warehouseEnabled: true,
  chatId: 'tenant-test',
  sessionToken: 'session-test',
  syncUrl: 'http://sellify.test',
  locationId: 'location-test',
});
setProducts([{ id: 'P-TEST', name: 'Test product', price: 100, stock: 10 }]);
setStockTransactions([]);
setInventoryMovements([]);

function order(id, type) {
  return {
    id,
    server_order_id: `SERVER-${id}`,
    fulfillment_type: type,
    fulfillment_status: 'pending',
    fulfillment_sync_status: 'confirmed',
    stock_deducted: false,
    items: [{ id: 'P-TEST', qty: 2 }],
  };
}

// Delivery progresses only after the canonical backend confirms each transition.
const delivery = order('DELIVERY', 'delivery');
setOrders([delivery]);
assert.equal(nextFulfillmentStatus(delivery), 'out_for_delivery');
await advanceFulfillmentOrder(delivery.id);
assert.equal(delivery.fulfillment_status, 'out_for_delivery');
assert.equal(delivery.fulfillment_sync_status, 'confirmed');
assert.equal(nextFulfillmentStatus(delivery), 'delivered');
await advanceFulfillmentOrder(delivery.id);
assert.equal(delivery.fulfillment_status, 'delivered');
assert.equal(isFulfillmentFinal(delivery.fulfillment_status), true);

const requestCountAfterDelivery = calls.length;
await advanceFulfillmentOrder(delivery.id);
assert.equal(calls.length, requestCountAfterDelivery, 'final delivery must not issue another transition');

// Pickup follows its own canonical lifecycle.
const pickup = order('PICKUP', 'pickup');
setOrders([pickup]);
assert.equal(nextFulfillmentStatus(pickup), 'ready_for_pickup');
await advanceFulfillmentOrder(pickup.id);
assert.equal(pickup.fulfillment_status, 'ready_for_pickup');
assert.equal(nextFulfillmentStatus(pickup), 'picked_up');
await advanceFulfillmentOrder(pickup.id);
assert.equal(pickup.fulfillment_status, 'picked_up');
assert.equal(isFulfillmentFinal(pickup.fulfillment_status), true);

const requestCountAfterPickup = calls.length;
await advanceFulfillmentOrder(pickup.id);
assert.equal(calls.length, requestCountAfterPickup, 'final pickup must not issue another transition');

// The client never fabricates local stock consequences; those are owned by the backend.
assert.equal(state.products[0].stock, 10);
assert.equal(state.stockTransactions.length, 0);
assert.equal(state.inventoryMovements.length, 0);
assert.equal(calls.length, 4);
for (const call of calls) {
  assert.equal(call.method, 'POST');
  assert.ok(call.headers['Idempotency-Key']);
  assert.equal(call.body.locationId, 'location-test');
}

for (const invalid of [
  { fulfillment_type: 'shipping', fulfillment_status: 'pending' },
  { fulfillment_type: 'delivery', fulfillment_status: 'ready_for_pickup' },
  { fulfillment_type: 'delivery', fulfillment_status: 'delivered' },
  { fulfillment_type: 'pickup', fulfillment_status: 'picked_up' },
]) {
  assert.equal(nextFulfillmentStatus(invalid), null);
}

console.log('Phase 12.3 Canonical Physical Fulfillment Lifecycle Regression: PASS');
