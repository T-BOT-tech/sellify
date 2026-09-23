import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = { getItem(k){ return storage.has(k) ? storage.get(k) : null; }, setItem(k,v){ storage.set(k,String(v)); }, removeItem(k){ storage.delete(k); } };
globalThis.window = globalThis;
globalThis.__APP_CONFIG__ = {};
globalThis.document = { getElementById(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, createElement(){ return { set textContent(v){ this._v=v; }, get innerHTML(){ return this._v || ''; } }; } };
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });

const state = await import('../app/src/state.js');
const { config, setConfig, setProducts, setOrders, setStockTransactions, setInventoryMovements, setOutboxEvents } = state;
const { setIdbUnavailable } = await import('../app/src/storage/idb.js');
setIdbUnavailable(true);
const { advanceFulfillmentOrder } = await import('../app/src/logistics/fulfillment.js');

function reset(products = []) {
  setConfig({ ...config, logisticsEnabled: true, warehouseEnabled: true, chatId: '', sessionToken: '' });
  setProducts(products); setOrders([]); setStockTransactions([]); setInventoryMovements([]); setOutboxEvents([]);
}
const product = (id, stock = 10) => ({ id, name: id, price: 100, stock });

// 1. Final transition refuses to partially mutate stock when an item would overrun.
reset([product('A', 10), product('B', 1)]);
const blocked = { id:'ORDER-12.7-BLOCKED', fulfillment_type:'delivery', fulfillment_status:'out_for_delivery', stock_deducted:false, items:[{id:'A',qty:2},{id:'B',qty:2}] };
setOrders([blocked]);
advanceFulfillmentOrder(blocked.id);
assert.equal(blocked.fulfillment_status, 'out_for_delivery');
assert.equal(blocked.stock_deducted, false);
assert.deepEqual(state.products.map(p => p.stock), [10,1]);
assert.equal(state.stockTransactions.length, 0);
assert.equal(state.inventoryMovements.length, 0);

// 2. Valid final transition deducts exactly once and records stable sale references.
reset([product('A', 10), product('B', 5)]);
const order = { id:'ORDER-12.7-SALE', fulfillment_type:'delivery', fulfillment_status:'out_for_delivery', stock_deducted:false, items:[{id:'A',qty:2},{id:'B',qty:1}] };
setOrders([order]);
advanceFulfillmentOrder(order.id);
assert.equal(order.fulfillment_status, 'delivered');
assert.equal(order.stock_deducted, true);
assert.deepEqual(state.products.map(p => p.stock), [8,4]);
assert.equal(state.stockTransactions.length, 2);
assert.equal(state.inventoryMovements.length, 2);
for (const movement of state.inventoryMovements) {
  assert.equal(movement.movementType, 'SALE');
  assert.equal(movement.referenceType, 'order');
  assert.equal(movement.referenceId, order.id);
  assert.match(movement.eventId, new RegExp(`^fulfillment_sale:${order.id}:`));
}

// 3. Terminal re-entry remains idempotent.
const stocks = state.products.map(p => p.stock);
const txCount = state.stockTransactions.length;
const movementCount = state.inventoryMovements.length;
advanceFulfillmentOrder(order.id);
assert.deepEqual(state.products.map(p => p.stock), stocks);
assert.equal(state.stockTransactions.length, txCount);
assert.equal(state.inventoryMovements.length, movementCount);

// 4. Missing product does not mark stock as deducted or advance final state.
reset([product('A', 10)]);
const missing = { id:'ORDER-12.7-MISSING', fulfillment_type:'pickup', fulfillment_status:'ready_for_pickup', stock_deducted:false, items:[{id:'MISSING',qty:1}] };
setOrders([missing]);
advanceFulfillmentOrder(missing.id);
assert.equal(missing.fulfillment_status, 'ready_for_pickup');
assert.equal(missing.stock_deducted, false);
assert.equal(state.products[0].stock, 10);
assert.equal(state.stockTransactions.length, 0);

console.log('Phase 12.7 Warehouse Hardening Regression: PASS');
