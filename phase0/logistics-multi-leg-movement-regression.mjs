import assert from 'node:assert/strict';
import {
  normalizeLogisticsMovementLeg,
  validateLogisticsMultiLegComposition,
  assertLogisticsMultiLegBoundary,
  logisticsMultiLegMovementContract,
} from '../app/src/verticals/logistics/multi-leg-movement-contract.js';

const contract = logisticsMultiLegMovementContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.requirements_validation_required, true);
assert.equal(contract.persistence, 'deferred_until_real_requirements');
assert.equal(contract.movement_authority, 'existing_movement');
assert.equal(contract.shipment_authority, 'existing_shipment');
assert.equal(contract.duplicate_shipment_authority, false);
assert.equal(contract.persistent_leg_store, false);
assert.equal(contract.routing_engine, false);
assert.equal(contract.optimization_engine, false);
assert.equal(contract.gps_authority, false);
assert.equal(contract.payment_mutation, false);
assert.equal(contract.inventory_mutation, false);
assert.equal(contract.fulfillment_mutation, false);
assert.equal(contract.settlement_mutation, false);

assert.deepEqual(
  normalizeLogisticsMovementLeg({
    role: 'pickup',
    sequence: 1,
    movement_ref: 'movement-1',
    shipment_ref: 'shipment-1',
    origin_ref: 'origin-1',
  }),
  {
    role: 'PICKUP',
    sequence: 1,
    movement_ref: 'movement-1',
    shipment_ref: 'shipment-1',
    origin_ref: 'origin-1',
    destination_ref: null,
  },
);

assert.throws(
  () => normalizeLogisticsMovementLeg({ role: 'route', movement_ref: 'movement-1' }),
  /Unsupported multi-leg role/,
);

const valid = validateLogisticsMultiLegComposition({
  movementRef: 'movement-1',
  legs: [
    { role: 'pickup', sequence: 1, movement_ref: 'movement-1' },
    { role: 'delivery', sequence: 2, movement_ref: 'movement-1' },
  ],
});
assert.equal(valid.valid, true);
assert.equal(valid.reason, 'MULTI_LEG_COMPOSITION_VALID');
assert.deepEqual(valid.legs.map(leg => leg.role), ['PICKUP', 'DELIVERY']);

assert.equal(
  validateLogisticsMultiLegComposition({
    movementRef: 'movement-1',
    legs: [{ role: 'pickup', sequence: 1, movement_ref: 'movement-1' }],
  }).reason,
  'MULTI_LEG_REQUIRES_AT_LEAST_TWO_LEGS',
);

assert.equal(
  validateLogisticsMultiLegComposition({
    movementRef: 'movement-1',
    legs: [
      { role: 'pickup', sequence: 1, movement_ref: 'movement-1' },
      { role: 'handoff', sequence: 1, movement_ref: 'movement-1' },
    ],
  }).reason,
  'LEG_SEQUENCE_MUST_BE_UNIQUE',
);

assert.equal(
  validateLogisticsMultiLegComposition({
    movementRef: 'movement-1',
    legs: [
      { role: 'pickup', sequence: 1, movement_ref: 'movement-1' },
      { role: 'delivery', sequence: 2, movement_ref: 'movement-2' },
    ],
  }).reason,
  'LEG_MOVEMENT_REFERENCE_MISMATCH',
);

assert.deepEqual(
  assertLogisticsMultiLegBoundary(),
  { valid: false, reason: 'MULTI_LEG_REQUIREMENTS_NOT_VALIDATED' },
);
assert.deepEqual(
  assertLogisticsMultiLegBoundary({ requirementsValidated: true }),
  { valid: true, reason: 'MULTI_LEG_BOUNDARY_VALIDATED' },
);
assert.equal(
  assertLogisticsMultiLegBoundary({ requirementsValidated: true, persistentLegStore: true }).valid,
  false,
);
assert.equal(
  assertLogisticsMultiLegBoundary({ requirementsValidated: true, duplicateShipmentAuthority: true }).valid,
  false,
);
assert.equal(
  assertLogisticsMultiLegBoundary({ requirementsValidated: true, downstreamMutation: true }).valid,
  false,
);

console.log('L13 Multi-Leg Movement Boundary Regression: PASS');
