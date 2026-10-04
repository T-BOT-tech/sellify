// L13 — Multi-Leg Movement Boundary.
// Requirement-validation and composition contract only.
// Persistent multi-leg legs remain deferred until real operational requirements exist.
// Existing Movement → Shipment authority is preserved; this module creates no leg store.

export const LOGISTICS_MULTI_LEG_MOVEMENT_CONTRACT_VERSION = '1.0';

const SUPPORTED_LEG_ROLES = Object.freeze([
  'PICKUP',
  'LINEHAUL',
  'HANDOFF',
  'DELIVERY',
]);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function normalizeLeg(value) {
  if (!value || typeof value !== 'object') throw new TypeError('leg is required');
  const role = requiredText(value.role, 'leg.role').toUpperCase();
  if (!SUPPORTED_LEG_ROLES.includes(role)) {
    throw new TypeError(`Unsupported multi-leg role: ${role}`);
  }
  return Object.freeze({
    role,
    sequence: Number.isInteger(value.sequence) ? value.sequence : null,
    movement_ref: requiredText(value.movement_ref, 'leg.movement_ref'),
    shipment_ref: value.shipment_ref ? String(value.shipment_ref) : null,
    origin_ref: value.origin_ref ? String(value.origin_ref) : null,
    destination_ref: value.destination_ref ? String(value.destination_ref) : null,
  });
}

export function normalizeLogisticsMovementLeg(leg) {
  return normalizeLeg(leg);
}

export function validateLogisticsMultiLegComposition({ movementRef, legs = [] } = {}) {
  const movement = requiredText(movementRef, 'movementRef');
  if (!Array.isArray(legs)) throw new TypeError('legs must be an array');

  const normalized = legs.map(normalizeLeg);
  const seen = new Set();

  for (const leg of normalized) {
    if (seen.has(leg.role)) {
      return Object.freeze({
        valid: false,
        reason: 'DUPLICATE_LEG_ROLE',
        movement_ref: movement,
        leg_role: leg.role,
      });
    }
    seen.add(leg.role);
    if (leg.movement_ref !== movement) {
      return Object.freeze({
        valid: false,
        reason: 'LEG_MOVEMENT_REFERENCE_MISMATCH',
        movement_ref: movement,
        leg_movement_ref: leg.movement_ref,
      });
    }
  }

  if (normalized.length < 2) {
    return Object.freeze({
      valid: false,
      reason: 'MULTI_LEG_REQUIRES_AT_LEAST_TWO_LEGS',
      movement_ref: movement,
    });
  }

  const sequences = normalized.map(leg => leg.sequence).filter(value => value !== null);
  if (sequences.length && sequences.length !== normalized.length) {
    return Object.freeze({
      valid: false,
      reason: 'LEG_SEQUENCE_MUST_BE_COMPLETE',
      movement_ref: movement,
    });
  }

  if (sequences.length && new Set(sequences).size !== sequences.length) {
    return Object.freeze({
      valid: false,
      reason: 'LEG_SEQUENCE_MUST_BE_UNIQUE',
      movement_ref: movement,
    });
  }

  return Object.freeze({
    valid: true,
    reason: 'MULTI_LEG_COMPOSITION_VALID',
    movement_ref: movement,
    legs: Object.freeze([...normalized].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))),
  });
}

export function assertLogisticsMultiLegBoundary({
  requirementsValidated = false,
  existingMovementAuthority = true,
  existingShipmentAuthority = true,
  duplicateShipmentAuthority = false,
  persistentLegStore = false,
  downstreamMutation = false,
} = {}) {
  if (!requirementsValidated) return Object.freeze({ valid: false, reason: 'MULTI_LEG_REQUIREMENTS_NOT_VALIDATED' });
  if (!existingMovementAuthority) return Object.freeze({ valid: false, reason: 'EXISTING_MOVEMENT_AUTHORITY_REQUIRED' });
  if (!existingShipmentAuthority) return Object.freeze({ valid: false, reason: 'EXISTING_SHIPMENT_AUTHORITY_REQUIRED' });
  if (duplicateShipmentAuthority) return Object.freeze({ valid: false, reason: 'DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN' });
  if (persistentLegStore) return Object.freeze({ valid: false, reason: 'PERSISTENT_LEG_STORE_DEFERRED' });
  if (downstreamMutation) return Object.freeze({ valid: false, reason: 'MULTI_LEG_DOWNSTREAM_MUTATION_FORBIDDEN' });
  return Object.freeze({ valid: true, reason: 'MULTI_LEG_BOUNDARY_VALIDATED' });
}

export function logisticsMultiLegMovementContract() {
  return Object.freeze({
    version: LOGISTICS_MULTI_LEG_MOVEMENT_CONTRACT_VERSION,
    requirements_validation_required: true,
    persistence: 'deferred_until_real_requirements',
    movement_authority: 'existing_movement',
    shipment_authority: 'existing_shipment',
    duplicate_shipment_authority: false,
    persistent_leg_store: false,
    routing_engine: false,
    optimization_engine: false,
    gps_authority: false,
    payment_mutation: false,
    inventory_mutation: false,
    fulfillment_mutation: false,
    settlement_mutation: false,
  });
}
