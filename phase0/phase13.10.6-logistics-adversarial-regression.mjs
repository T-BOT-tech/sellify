import assert from 'node:assert/strict';
import { normalizeDeliveryProof, normalizeLogisticsReturn } from '../app/src/verticals/logistics/proof-return-contract.js';
import { getLogisticsFulfillmentContext } from '../app/src/verticals/logistics/fulfillment-boundary.js';

assert.throws(() => normalizeDeliveryProof(null), /Delivery proof is required/);
assert.throws(() => normalizeDeliveryProof({ type: 'photo' }), /proof.ref/);
assert.throws(() => normalizeLogisticsReturn(null), /Logistics return is required/);
assert.throws(() => normalizeLogisticsReturn({ order_id: 'X', status: 'requested', proof: { type: 'bad', ref: 'x' } }), /Unsupported proof type/);
const original = { id: 'O-1', fulfillment_type: 'pickup', fulfillment_status: 'ready_for_pickup', pickup_location: 'Main' };
const snapshot = JSON.stringify(original);
const projected = getLogisticsFulfillmentContext(original);
assert.equal(projected.final, false);
assert.equal(JSON.stringify(original), snapshot);
assert.equal(getLogisticsFulfillmentContext({ id: 'O-2', fulfillment_type: 'pickup', fulfillment_status: 'picked_up' }).final, true);
console.log('Phase 13.10.6 Logistics Adversarial / Isolation Regression: PASS');
