import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-fux42-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

// Seed legacy catalog data before SQLite initialization so the opening-balance
// migration is exercised against both a physical product and a stock-shaped service.
fs.writeFileSync(path.join(dataDir, 'catalogs.json'), JSON.stringify({
  'fux42-chat': { products: [
    { id: 'legacy-physical', name: 'Legacy physical item', price: 100, stock: 4 },
    { id: 'legacy-service', name: 'Legacy service with stale stock', price: 200, type: 'service', stock: 9 },
  ] },
}));

const {
  getOrCreateTenant,
  saveQueuedOrders,
  saveCatalog,
  getCatalog,
  getOrderFulfillment,
  appendInventoryMovement,
  transitionOrderFulfillment,
  coreFulfillmentContract,
} = await import('../backend/lib/store-sqlite.js');

const chatId = 'fux42-chat';
const tenant = await getOrCreateTenant(chatId);

const legacyBalances = await (await import('../backend/lib/store-sqlite.js')).getInventoryBalances(chatId);
assert.equal(legacyBalances.find((row) => row.productId === 'legacy-physical')?.quantity, 4,
  'legacy physical stock still seeds its canonical opening balance');
assert.equal(legacyBalances.find((row) => row.productId === 'legacy-service'), undefined,
  'legacy service stock never seeds a canonical opening-balance movement');

// Unsupported item types and marketplace service listings fail closed at the
// backend boundary; UI restrictions alone are not the contract.
await assert.rejects(
  saveCatalog(chatId, [{ id: 'invalid-type', name: 'Invalid', price: 100, type: 'digital' }]),
  (error) => error?.code === 'INVALID_CATALOG_ITEM_TYPE' && error?.statusCode === 400,
);
await assert.rejects(
  saveCatalog(chatId, [{ id: 'service-marketplace', name: 'Remote service', price: 100, type: 'service', marketplace_listed: true }]),
  (error) => error?.code === 'SERVICE_MARKETPLACE_UNSUPPORTED' && error?.statusCode === 409,
);
await saveCatalog(chatId, [
  { id: 'product-1', name: 'Test item', price: 500, stock: 0 },
  { id: 'service-1', name: 'Consultation', price: 700, type: 'service' },
]);
// Invalid replacement payloads must fail before DELETE/reinsert, preserving the
// last known-good catalog instead of accidentally clearing it.
await assert.rejects(
  saveCatalog(chatId, null),
  (error) => error?.code === 'INVALID_CATALOG_PAYLOAD' && error?.statusCode === 400,
);
await assert.rejects(
  saveCatalog(chatId, [{ id: 'valid-looking', name: 'Valid', price: 100 }, null]),
  (error) => error?.code === 'INVALID_CATALOG_ITEM' && error?.statusCode === 400,
);
await assert.rejects(
  saveCatalog(chatId, [{ name: 'Missing identity', price: 100 }]),
  (error) => error?.code === 'INVALID_CATALOG_ITEM' && error?.statusCode === 400,
);
assert.deepEqual((await getCatalog(chatId)).products.map(item => item.id).sort(), ['product-1', 'service-1'],
  'malformed replacement payloads cannot delete or partially replace the existing catalog');
await assert.rejects(
  saveCatalog(chatId, [
    { id: 'product-1', name: 'Test item', price: 500, stock: 5, type: 'service' },
    { id: 'service-1', name: 'Consultation', price: 700, type: 'service' },
  ]),
  (error) => error?.code === 'CATALOG_ITEM_TYPE_CONFLICT' && error?.statusCode === 409,
);
const canonicalCatalog = await getCatalog(chatId);
assert.equal(canonicalCatalog.products.find((item) => item.id === 'product-1')?.type, 'product');
assert.equal(canonicalCatalog.products.find((item) => item.id === 'service-1')?.type, 'service');
await appendInventoryMovement(chatId, { productId: 'product-1', quantity: 5, movementType: 'PURCHASE', eventId: 'fux42-opening-purchase' });
const openingBalances = await (await import('../backend/lib/store-sqlite.js')).getInventoryBalances(chatId);
assert.equal(openingBalances.find((row) => row.productId === 'product-1')?.quantity, 5);
const syncResult = await saveQueuedOrders(chatId, [{
  id: 'local-fux42-1',
  items: [
    // A client cannot relabel a physical catalog item as a service to bypass stock.
    { id: 'product-1', name: 'Test item', qty: 1, price: 500, type: 'service' },
    // Nor can a client-supplied physical type turn a canonical service into stock.
    { id: 'service-1', name: 'Consultation', qty: 1, price: 700, type: 'product' },
  ],
  fulfillment_type: 'delivery',
  delivery_address: 'Jimma',
  scheduled_time: '2026-09-24T12:00:00Z',
}]);
assert.equal(syncResult[0].status, 'synced');
const orderId = syncResult[0].order_id;

let fulfillment = await getOrderFulfillment(chatId, orderId);
assert.equal(fulfillment, null);

const actor = {
  userId: 'fux42-user',
  deviceId: 'fux42-device',
  locationId: null,
};

fulfillment = await transitionOrderFulfillment(chatId, orderId, 'out_for_delivery', actor, {
  idempotencyKey: 'fux42-command-1',
});
assert.equal(fulfillment.status, 'out_for_delivery');
assert.equal(fulfillment.fulfillmentType, 'delivery');
assert.equal(fulfillment.destination, 'Jimma');
assert.equal(fulfillment.organizationId, tenant.organizationId);

const replay = await transitionOrderFulfillment(chatId, orderId, 'out_for_delivery', actor, {
  idempotencyKey: 'fux42-command-1',
});
assert.equal(replay.id, fulfillment.id);
assert.equal(replay.status, 'out_for_delivery');

fulfillment = await transitionOrderFulfillment(chatId, orderId, 'delivered', actor, {
  idempotencyKey: 'fux42-command-2',
  proof: { type: 'photo', ref: 'proof-fux42' },
});
assert.equal(fulfillment.status, 'delivered');
const balances = await (await import('../backend/lib/store-sqlite.js')).getInventoryBalances(chatId);
const productBalance = balances.find((row) => row.productId === 'product-1');
assert.equal(productBalance?.quantity, 4);
assert.equal(balances.find((row) => row.productId === 'service-1'), undefined);
assert.deepEqual(fulfillment.proof, { type: 'photo', ref: 'proof-fux42' });

// Duplicate physical item lines must be aggregated into one full-quantity sale.
const duplicateSync = await saveQueuedOrders(chatId, [{
  id: 'local-fux42-duplicate-lines',
  items: [
    { id: 'product-1', name: 'Test item', qty: 1, price: 500 },
    { id: 'product-1', name: 'Test item', qty: 1, price: 500 },
  ],
  fulfillment_type: 'delivery',
  delivery_address: 'Jimma',
}]);
assert.equal(duplicateSync[0].status, 'synced');
const duplicateOrderId = duplicateSync[0].order_id;
await transitionOrderFulfillment(chatId, duplicateOrderId, 'out_for_delivery', actor, {
  idempotencyKey: 'fux42-duplicate-lines-out',
});
await transitionOrderFulfillment(chatId, duplicateOrderId, 'delivered', actor, {
  idempotencyKey: 'fux42-duplicate-lines-delivered',
});
const duplicateBalances = await (await import('../backend/lib/store-sqlite.js')).getInventoryBalances(chatId);
assert.equal(duplicateBalances.find((row) => row.productId === 'product-1')?.quantity, 2,
  'two duplicate quantity-1 lines must deduct two units, not one');

await assert.rejects(
  transitionOrderFulfillment(chatId, orderId, 'pending', actor, { idempotencyKey: 'fux42-invalid' }),
  (error) => error?.code === 'INVALID_FULFILLMENT_TRANSITION' && error?.statusCode === 409,
);

await assert.rejects(
  transitionOrderFulfillment(chatId, orderId, 'delivered', { ...actor, locationId: 'foreign-location' }, { idempotencyKey: 'fux42-foreign-location' }),
  (error) => error?.code === 'LOCATION_SCOPE_DENIED' && error?.statusCode === 400,
);

const contract = coreFulfillmentContract();
assert.equal(contract.entity, 'fulfillments');
assert.equal(contract.order_authority, 'orders');
assert.equal(contract.transition_authority, 'server');
assert.equal(contract.marketplace_fulfillment_reuse, false);
assert.equal(contract.payment_authority, 'unchanged; delivery does not mutate payment state or payment ledger');
assert.match(contract.delivery_transitions, /pending -> out_for_delivery -> delivered/);

console.log('FUX-42 Core Fulfillment Authority Regression: PASS');
console.log('Canonical Order -> Core Fulfillment: PASS');
console.log('Server transition authority: PASS');
console.log('Idempotent replay: PASS');
console.log('Invalid transition rejection: PASS');
console.log('Organization/location scope: PASS');
console.log('Terminal fulfillment inventory consequence: PASS');
console.log('Marketplace fulfillment remains separate: PASS');
