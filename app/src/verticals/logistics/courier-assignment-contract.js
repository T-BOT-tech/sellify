// Phase 13.10.12 — Courier assignment boundary.
// Formalizes courier-to-delivery coordination without introducing a second
// order, fulfillment, location, or external-provider persistence authority.

const COURIER_SOURCES = new Set(['sellify', 'carrier', 'provider', 'manual', 'other']);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field);
}

/**
 * Normalize a courier identity for assignment. Courier identity is a Logistics
 * coordination concept; no courier registry or provider record is persisted.
 */
export function normalizeCourier(courier) {
  if (!courier || typeof courier !== 'object') throw new TypeError('Courier is required');
  const id = requiredText(courier.id ?? courier.courier_id, 'courier.id');
  const name = optionalText(courier.name ?? courier.display_name, 'courier.name');
  const source = String(courier.source ?? 'manual').trim().toLowerCase();
  if (!COURIER_SOURCES.has(source)) throw new TypeError(`Unsupported courier source: ${source}`);
  return Object.freeze({ id, name, source });
}

/**
 * Build a persistence-neutral courier assignment for an existing delivery.
 * Existing Commerce/Fulfillment state remains authoritative for the order and
 * delivery lifecycle. The returned assignment is coordination metadata only.
 * Replaying the same courier assignment is safe; replacing an existing
 * assignment with another courier must be an explicit conflict, not a silent
 * overwrite.
 */
export function assignCourier({ delivery, courier, existingAssignment = null } = {}) {
  if (!delivery || typeof delivery !== 'object') throw new TypeError('Delivery is required');
  const deliveryId = requiredText(delivery.id ?? delivery.delivery_id, 'delivery.id');
  const orderId = requiredText(delivery.order_id, 'delivery.order_id');
  const fulfillmentType = requiredText(delivery.fulfillment_type, 'fulfillment_type').toLowerCase();
  if (fulfillmentType !== 'delivery') throw new TypeError('Courier assignment requires delivery fulfillment');

  const courierValue = normalizeCourier(courier);
  const existing = existingAssignment && typeof existingAssignment === 'object'
    ? {
      delivery_id: requiredText(existingAssignment.delivery_id, 'assignment.delivery_id'),
      order_id: requiredText(existingAssignment.order_id, 'assignment.order_id'),
      courier_id: requiredText(existingAssignment.courier_id, 'assignment.courier_id'),
    }
    : null;

  if (existing && existing.delivery_id !== deliveryId) {
    throw new TypeError('Courier assignment conflicts with existing delivery');
  }
  if (existing && existing.order_id !== orderId) {
    throw new TypeError('Courier assignment conflicts with existing order');
  }
  if (existing && existing.courier_id !== courierValue.id) {
    throw new TypeError('Courier assignment conflicts with existing courier');
  }

  return Object.freeze({
    delivery_id: deliveryId,
    order_id: orderId,
    courier: courierValue,
    assignment_status: 'assigned',
    assignment_key: `courier:${deliveryId}:${courierValue.id}`,
    persistence: 'coordination_contract_only',
    mutation_authority: 'logistics-pack',
    replay: Boolean(existing),
  });
}

export function isCourierAssignmentContract(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.delivery_id === 'string' &&
    typeof value.order_id === 'string' &&
    value.courier && typeof value.courier.id === 'string' &&
    value.assignment_status === 'assigned' &&
    typeof value.assignment_key === 'string' &&
    value.persistence === 'coordination_contract_only' &&
    value.mutation_authority === 'logistics-pack');
}

export function logisticsCourierAssignmentContract() {
  return Object.freeze({
    courier_authority: 'logistics-pack',
    delivery_lifecycle_authority: 'app/src/logistics/fulfillment.js',
    order_authority: 'commerce',
    location_authority: 'locations',
    external_provider_authority: 'external_provider_where_external',
    assignment_idempotency_key: 'assignment_key',
    conflict_policy: 'same_delivery_and_courier_replays; different_courier_rejects',
    persistence: 'none',
    duplicate_courier_registry: false,
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    adapter_boundary: 'Canonical Contract → Adapter → Provider',
  });
}
