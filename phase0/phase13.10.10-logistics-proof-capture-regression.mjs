import assert from 'node:assert/strict';
import {
  normalizeDeliveryProof,
  captureDeliveryProof,
  logisticsProofReturnContract,
} from '../app/src/verticals/logistics/proof-return-contract.js';

const order = {
  id: 'ORDER-13.10.10-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
};
const snapshot = JSON.stringify(order);

const captured = captureDeliveryProof({
  order,
  proof: { type: 'PHOTO', ref: 'proof-photo-1', captured_at: '2026-09-08T10:30:00Z' },
});
assert.deepEqual(captured.fulfillment_proof, {
  type: 'photo',
  ref: 'proof-photo-1',
  captured_at: '2026-09-08T10:30:00Z',
});
assert.equal(captured.order_id, order.id);
assert.equal(captured.mutation_authority, 'commerce_order');
assert.equal(captured.persistence, 'existing_core_order_fields_only');
assert.equal(captured.replay, false);
assert.equal(JSON.stringify(order), snapshot);

// Same proof replay is idempotent and does not create another authority.
const existing = {
  ...order,
  fulfillment_proof: normalizeDeliveryProof({ type: 'photo', ref: 'proof-photo-1' }),
};
const replay = captureDeliveryProof({
  order: existing,
  proof: { type: 'photo', ref: 'proof-photo-1' },
});
assert.equal(replay.replay, true);
assert.equal(replay.fulfillment_proof.ref, 'proof-photo-1');

// A different proof cannot silently overwrite the existing canonical proof.
assert.throws(() => captureDeliveryProof({
  order: existing,
  proof: { type: 'signature', ref: 'proof-signature-2' },
}), /conflicts with existing fulfillment_proof/);

assert.throws(() => captureDeliveryProof({
  order: { id: 'O', fulfillment_type: 'pickup', fulfillment_status: 'picked_up' },
  proof: { type: 'photo', ref: 'p' },
}), /requires a delivery fulfillment/);
assert.throws(() => captureDeliveryProof({
  order: { id: 'O', fulfillment_type: 'delivery', fulfillment_status: 'out_for_delivery' },
  proof: { type: 'photo', ref: 'p' },
}), /requires delivered fulfillment status/);
assert.throws(() => captureDeliveryProof({
  order: { id: 'O', fulfillment_type: 'delivery', fulfillment_status: 'delivered' },
  proof: { type: 'gps', ref: 'p' },
}), /Unsupported proof type/);

const contract = logisticsProofReturnContract();
assert.equal(contract.proof_authority, 'logistics-pack');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.persistence, 'none');

console.log('Phase 13.10.10 Logistics Proof of Delivery Capture Regression: PASS');
