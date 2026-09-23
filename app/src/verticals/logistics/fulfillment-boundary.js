// Phase 13.10 — Logistics ↔ Core Fulfillment boundary.
// This is a read-only integration contract over the existing order fields.

const TYPES = new Set(['pickup', 'delivery']);
const STATUSES = new Set(['pending', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered']);
const FINAL = new Set(['picked_up', 'delivered']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Logistics ${field} must be a non-empty string`);
  return result;
}

export function getLogisticsFulfillmentContext(order) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const orderId = text(order.id, 'order_id');
  const type = text(order.fulfillment_type, 'fulfillment_type');
  if (!TYPES.has(type)) throw new TypeError(`Unsupported fulfillment type: ${type}`);
  const status = text(order.fulfillment_status, 'fulfillment_status');
  if (!STATUSES.has(status)) throw new TypeError(`Unsupported fulfillment status: ${status}`);

  return Object.freeze({
    order_id: orderId,
    fulfillment_type: type,
    fulfillment_status: status,
    shipment_id: order.shipment_id ?? null,
    tracking_reference: order.tracking_reference ?? null,
    destination: type === 'delivery'
      ? (order.delivery_address ?? order.fulfillment_address ?? null)
      : (order.pickup_location ?? order.fulfillment_pickup_location ?? null),
    scheduled_at: order.scheduled_time ?? order.fulfillment_scheduled_time ?? null,
    proof: order.fulfillment_proof ?? null,
    final: FINAL.has(status),
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    logistics_role: 'coordinate_and_project',
    mutation_authority: 'app/src/logistics/fulfillment.js',
  });
}

export function isLogisticsFulfillmentContext(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.order_id === 'string' &&
    TYPES.has(value.fulfillment_type) &&
    STATUSES.has(value.fulfillment_status) &&
    typeof value.final === 'boolean' &&
    value.order_authority === 'commerce' &&
    value.fulfillment_authority === 'app/src/logistics/fulfillment.js');
}

export function logisticsFulfillmentBoundaryContract() {
  return Object.freeze({
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    logistics_role: 'coordinate_and_project',
    lifecycle_mutation: 'fulfillment_only',
    stock_mutation: 'app/src/warehouse/inventory.js#applyStockChange',
    final_statuses: Object.freeze(['picked_up', 'delivered']),
    duplicate_fulfillment_authority: false,
    logistics_fulfillment_entity: false,
    persistence: 'none',
  });
}
