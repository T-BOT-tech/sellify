// Phase 13.9.6 — Warehouse ↔ Core Fulfillment boundary contract.
//
// Fulfillment owns the order physical-lifecycle state machine. Warehouse may
// consume the lifecycle projection and participate in the existing inventory
// deduction path, but it does not create WarehouseFulfillment or a second
// fulfillment authority.

const FULFILLMENT_TYPES = new Set(['pickup', 'delivery']);
const FINAL_STATUSES = new Set(['picked_up', 'delivered']);
const STATUSES = new Set(['pending', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result;
}

function boolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function getWarehouseFulfillmentContext(order) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const orderId = text(order.id, 'order_id');
  const type = text(order.fulfillment_type, 'fulfillment_type');
  if (!FULFILLMENT_TYPES.has(type)) throw new TypeError(`Unsupported fulfillment type: ${type}`);
  const status = text(order.fulfillment_status, 'fulfillment_status');
  if (!STATUSES.has(status)) throw new TypeError(`Unsupported fulfillment status: ${status}`);

  return Object.freeze({
    order_id: orderId,
    fulfillment_type: type,
    fulfillment_status: status,
    destination: order.delivery_address ?? order.pickup_location ?? null,
    scheduled_at: order.scheduled_time ?? null,
    tracking_reference: order.tracking_reference ?? null,
    proof: order.fulfillment_proof ?? null,
    stock_deducted: boolean(order.stock_deducted),
    final: FINAL_STATUSES.has(status),
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    order_authority: 'commerce',
  });
}

export function isWarehouseFulfillmentContext(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.order_id === 'string' &&
    FULFILLMENT_TYPES.has(value.fulfillment_type) &&
    STATUSES.has(value.fulfillment_status) &&
    typeof value.stock_deducted === 'boolean' &&
    typeof value.final === 'boolean' &&
    value.fulfillment_authority === 'app/src/logistics/fulfillment.js' &&
    value.order_authority === 'commerce');
}

export function warehouseFulfillmentBoundaryContract() {
  return Object.freeze({
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    order_authority: 'commerce',
    warehouse_role: 'consume_and_integrate',
    lifecycle_mutation: 'fulfillment_only',
    stock_mutation: 'app/src/warehouse/inventory.js#applyStockChange',
    final_statuses: Object.freeze(['picked_up', 'delivered']),
    stock_deduction_guard: 'order.stock_deducted',
    duplicate_fulfillment_authority: false,
    warehouse_fulfillment_entity: false,
    persistence: 'none',
  });
}
