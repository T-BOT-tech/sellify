// Phase 13.11.3 — Physical Commerce Spine contract.
//
// This is a pure, persistence-neutral projection across existing authorities:
// Commerce Order -> Core Fulfillment -> Warehouse consumption -> Logistics
// coordination. It deliberately does not create a second lifecycle, dispatch
// engine, shipment store, or cross-pack orchestrator.

import { toPhysicalFlow } from '../../logistics/physical-flow.js';
import { getWarehouseFulfillmentContext } from '../warehouse/fulfillment-boundary.js';
import { getLogisticsFulfillmentContext } from '../logistics/fulfillment-boundary.js';

const VERSION = '1.0';
const FINAL_STATUSES = new Set(['delivered', 'picked_up']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Physical Commerce ${field} must be a non-empty string`);
  return result;
}

function organizationOf(order) {
  return text(order?.organization_id ?? order?.organizationId, 'organization_id');
}

function assertSameOrganization(order, organizationId) {
  const orderOrganization = organizationOf(order);
  const expected = text(organizationId, 'organization_id');
  if (orderOrganization !== expected) {
    throw new TypeError('Physical Commerce order belongs to a different organization');
  }
  return expected;
}

/**
 * Build a canonical read-only physical-commerce spine for one existing Order.
 *
 * The projection is intentionally assembled from existing contracts rather
 * than introducing a new integration service. Warehouse and Logistics both
 * consume the same Order/Fulfillment authority.
 */
export function buildPhysicalCommerceSpine(order, { organizationId } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const orderId = text(order.id, 'order_id');
  const organization_id = assertSameOrganization(order, organizationId);

  const physicalFlow = toPhysicalFlow(order);
  if (!physicalFlow) throw new TypeError('Physical Commerce Order requires delivery or pickup fulfillment');

  const warehouse = getWarehouseFulfillmentContext(order);
  const logistics = getLogisticsFulfillmentContext(order);

  if (warehouse.order_id !== orderId || logistics.order_id !== orderId) {
    throw new TypeError('Physical Commerce fulfillment references do not match the Core Order');
  }
  if (warehouse.fulfillment_status !== logistics.fulfillment_status) {
    throw new TypeError('Physical Commerce fulfillment status conflict');
  }

  return Object.freeze({
    version: VERSION,
    spine_id: `physical-order:${orderId}`,
    organization_id,
    order: Object.freeze({
      order_id: orderId,
      authority: 'commerce',
      source: 'core_order',
    }),
    fulfillment: Object.freeze({
      type: physicalFlow.type,
      status: physicalFlow.status,
      authority: 'app/src/logistics/fulfillment.js',
      mutation_authority: 'app/src/logistics/fulfillment.js',
    }),
    warehouse: Object.freeze({
      role: 'consume_and_integrate',
      authority: 'warehouse',
      fulfillment_status: warehouse.fulfillment_status,
      stock_deducted: warehouse.stock_deducted,
      stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
      dispatch_boundary: 'semantic_only',
    }),
    logistics: Object.freeze({
      role: 'coordinate_and_project',
      shipment_id: logistics.shipment_id,
      tracking_reference: logistics.tracking_reference,
      proof: logistics.proof,
      fulfillment_status: logistics.fulfillment_status,
      authority: 'logistics-pack',
      lifecycle_mutation_authority: 'app/src/logistics/fulfillment.js',
    }),
    physical_flow: physicalFlow,
    final: FINAL_STATUSES.has(physicalFlow.status),
    direction: 'Commerce Order -> Fulfillment -> Warehouse integration -> Logistics coordination',
    dispatch: Object.freeze({
      implemented: false,
      authority: null,
      persistence: 'none',
      note: 'Dispatch is a future physical-flow milestone; no WarehouseDispatch authority exists in this increment.',
    }),
    persistence: 'none',
    idempotency: `physical-order:${orderId}`,
    conflict_policy: 'reject_cross_order_or_cross_status_conflicts; existing_core_authorities_win',
    event_behavior: 'projection_only; no event publication',
    audit_behavior: 'existing_authority_operations_only',
    reconciliation: 'resolve every physical reference against the same Core Order id and fulfillment status',
  });
}

export function isPhysicalCommerceSpine(value) {
  return Boolean(value && typeof value === 'object' &&
    value.version === VERSION &&
    typeof value.spine_id === 'string' &&
    typeof value.organization_id === 'string' &&
    value.order?.authority === 'commerce' &&
    value.fulfillment?.authority === 'app/src/logistics/fulfillment.js' &&
    value.warehouse?.dispatch_boundary === 'semantic_only' &&
    value.logistics?.authority === 'logistics-pack' &&
    value.dispatch?.implemented === false &&
    value.persistence === 'none');
}

export function physicalCommerceSpineContract() {
  return Object.freeze({
    version: VERSION,
    identifier: 'spine_id=physical-order:<core-order-id>',
    organization_scope: 'Core Order organization_id / organizationId',
    source: 'Core Order + existing fulfillment/warehouse/logistics contracts',
    owner: 'canonical core authorities; this module owns projection semantics only',
    direction: 'Commerce Order -> Fulfillment -> Warehouse integration -> Logistics coordination',
    lifecycle: 'existing fulfillment lifecycle only',
    permission_boundary: 'existing Core/Warehouse/Logistics permissions; no new mutation authority',
    idempotency_key: 'physical-order:<core-order-id>',
    conflict_policy: 'reject_cross_order_or_cross_status_conflicts; existing_core_authorities_win',
    event_behavior: 'projection_only; no event publication',
    audit_behavior: 'existing_authority_operations_only',
    reconciliation_behavior: 'resolve physical references against the same Core Order id and fulfillment status',
    dispatch_authority: null,
    dispatch_implemented: false,
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    duplicate_logistics_authority: false,
    persistence: 'none',
  });
}
