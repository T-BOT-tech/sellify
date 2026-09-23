// logistics/physical-flow.js
// Phase 12.1 / 12.2: canonical physical-flow compatibility boundary.
// Existing order fulfillment fields remain authoritative. This module is a
// pure projection; it does not create a second persistence model or mutate
// the legacy order.
//
// Phase 12.2 bridges the actual legacy field names used by checkout:
//   fulfillment_type
//   fulfillment_status
//   stock_deducted
// plus the existing destination/schedule fields:
//   delivery_address / pickup_location / scheduled_time
// Older/alternate prefixed field names are accepted as read-only fallbacks
// so the bridge can consume both historical and current local order shapes.

const FINAL_STATUSES = new Set(['delivered', 'picked_up']);

function booleanFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true' || value.trim() === '1';
  return false;
}

export function isPhysicalFulfillment(order) {
  return !!order && (order.fulfillment_type === 'delivery' || order.fulfillment_type === 'pickup');
}

export function toPhysicalFlow(order) {
  if (!isPhysicalFulfillment(order)) return null;

  const type = order.fulfillment_type;
  const status = order.fulfillment_status || 'pending';
  const destination = type === 'delivery'
    ? (order.delivery_address ?? order.fulfillment_address ?? '')
    : (order.pickup_location ?? order.fulfillment_pickup_location ?? '');
  const scheduledAt = order.scheduled_time ?? order.fulfillment_scheduled_time ?? null;

  return {
    id: `order:${String(order.id)}`,
    source: 'sellify.order',
    orderId: String(order.id),
    type,
    status,
    destination,
    scheduledAt,
    trackingReference: order.tracking_reference ?? null,
    proof: order.fulfillment_proof ?? null,
    stockDeducted: booleanFlag(order.stock_deducted),
    final: FINAL_STATUSES.has(status),
  };
}

export function physicalFlowStatus(flow) {
  return flow ? flow.status : null;
}
