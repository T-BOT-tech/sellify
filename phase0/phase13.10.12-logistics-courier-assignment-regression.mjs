import assert from 'node:assert/strict';
import {
  normalizeCourier,
  assignCourier,
  isCourierAssignmentContract,
  logisticsCourierAssignmentContract,
} from '../app/src/verticals/logistics/courier-assignment-contract.js';

const delivery = {
  id: 'DEL-001',
  order_id: 'ORD-001',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
};
const courier = { id: 'COURIER-7', name: 'Courier Seven', source: 'manual' };

const normalized = normalizeCourier(courier);
assert.deepEqual(normalized, { id: 'COURIER-7', name: 'Courier Seven', source: 'manual' });

const assignment = assignCourier({ delivery, courier });
assert.ok(isCourierAssignmentContract(assignment));
assert.equal(assignment.delivery_id, 'DEL-001');
assert.equal(assignment.order_id, 'ORD-001');
assert.equal(assignment.courier.id, 'COURIER-7');
assert.equal(assignment.assignment_status, 'assigned');
assert.equal(assignment.persistence, 'coordination_contract_only');
assert.equal(assignment.replay, false);

const replay = assignCourier({
  delivery,
  courier,
  existingAssignment: { delivery_id: 'DEL-001', order_id: 'ORD-001', courier_id: 'COURIER-7' },
});
assert.equal(replay.assignment_key, assignment.assignment_key);
assert.equal(replay.replay, true);

assert.throws(() => assignCourier({
  delivery,
  courier: { id: 'COURIER-8' },
  existingAssignment: { delivery_id: 'DEL-001', order_id: 'ORD-001', courier_id: 'COURIER-7' },
}), /conflicts with existing courier/);

assert.throws(() => assignCourier({
  delivery: { ...delivery, fulfillment_type: 'pickup' },
  courier,
}), /requires delivery fulfillment/);

assert.throws(() => normalizeCourier({ id: 'COURIER-9', source: 'unknown-provider' }), /Unsupported courier source/);

const contract = logisticsCourierAssignmentContract();
assert.equal(contract.courier_authority, 'logistics-pack');
assert.equal(contract.delivery_lifecycle_authority, 'app/src/logistics/fulfillment.js');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.location_authority, 'locations');
assert.equal(contract.persistence, 'none');
assert.equal(contract.duplicate_courier_registry, false);
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.assignment_idempotency_key, 'assignment_key');
assert.equal(contract.adapter_boundary, 'Canonical Contract → Adapter → Provider');

console.log('Phase 13.10.12 Courier Assignment Regression: PASS');
