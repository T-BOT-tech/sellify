import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-fux42-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

const {
  getOrCreateTenant,
  saveQueuedOrders,
  getOrderFulfillment,
  transitionOrderFulfillment,
  coreFulfillmentContract,
} = await import('../backend/lib/store-sqlite.js');

const chatId = 'fux42-chat';
const tenant = await getOrCreateTenant(chatId);
const syncResult = await saveQueuedOrders(chatId, [{
  id: 'local-fux42-1',
  items: [{ item_id: 'product-1', name: 'Test item', qty: 1, price: 500 }],
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
assert.deepEqual(fulfillment.proof, { type: 'photo', ref: 'proof-fux42' });

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
assert.equal(contract.payment_authority, 'unchanged');
assert.match(contract.delivery_transitions, /pending -> out_for_delivery -> delivered/);

console.log('FUX-42 Core Fulfillment Authority Regression: PASS');
console.log('Canonical Order -> Core Fulfillment: PASS');
console.log('Server transition authority: PASS');
console.log('Idempotent replay: PASS');
console.log('Invalid transition rejection: PASS');
console.log('Organization/location scope: PASS');
console.log('Marketplace fulfillment remains separate: PASS');
