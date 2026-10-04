// L14 — Hub / Depot Coordination Boundary.
// Composes existing Locations, Warehouse, Inventory, Fulfillment and Logistics
// authorities. This contract does not create a hub database, stock ledger, or
// fulfillment lifecycle.

export const LOGISTICS_HUB_DEPOT_CONTRACT_VERSION = '1.0';

const NODE_TYPES = Object.freeze(['HUB', 'DEPOT', 'HANDOFF_POINT']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function normalizeNode(value) {
  if (!value || typeof value !== 'object') throw new TypeError('hub/depot node is required');
  const type = text(value.type, 'node.type').toUpperCase();
  if (!NODE_TYPES.includes(type)) throw new TypeError(`Unsupported hub/depot node type: ${type}`);
  return Object.freeze({
    id: text(value.id, 'node.id'),
    type,
    location_ref: text(value.location_ref, 'node.location_ref'),
    organization_id: text(value.organization_id, 'node.organization_id'),
    warehouse_ref: value.warehouse_ref ? String(value.warehouse_ref) : null,
    fulfillment_ref: value.fulfillment_ref ? String(value.fulfillment_ref) : null,
  });
}

export function normalizeLogisticsHubDepotNode(node) {
  return normalizeNode(node);
}

export function validateLogisticsHubDepotComposition({ organizationId, node, warehouse, inventory, fulfillment, logistics } = {}) {
  const org = text(organizationId, 'organizationId');
  const normalized = normalizeNode(node);

  if (normalized.organization_id !== org) {
    return Object.freeze({ valid: false, reason: 'HUB_DEPOT_ORGANIZATION_SCOPE_VIOLATION' });
  }
  if (!warehouse || warehouse.authority !== 'warehouse') {
    return Object.freeze({ valid: false, reason: 'WAREHOUSE_AUTHORITY_REQUIRED' });
  }
  if (!inventory || inventory.authority !== 'inventory') {
    return Object.freeze({ valid: false, reason: 'INVENTORY_AUTHORITY_REQUIRED' });
  }
  if (!fulfillment || fulfillment.authority !== 'existing_core_fulfillment') {
    return Object.freeze({ valid: false, reason: 'FULFILLMENT_AUTHORITY_REQUIRED' });
  }
  if (!logistics || logistics.authority !== 'logistics_movement_coordination') {
    return Object.freeze({ valid: false, reason: 'LOGISTICS_COORDINATION_AUTHORITY_REQUIRED' });
  }

  return Object.freeze({
    valid: true,
    reason: 'HUB_DEPOT_COMPOSITION_VALID',
    node: normalized,
  });
}

export function assertLogisticsHubDepotBoundary({
  organizationScoped = true,
  createsInventoryLedger = false,
  createsFulfillmentAuthority = false,
  createsLocationAuthority = false,
  mutatesStockOutsideInventory = false,
  mutatesFulfillmentOutsideCore = false,
  logisticsExecutesWarehouse = false,
} = {}) {
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'HUB_DEPOT_ORGANIZATION_SCOPE_REQUIRED' });
  if (createsInventoryLedger) return Object.freeze({ valid: false, reason: 'DUPLICATE_INVENTORY_LEDGER_FORBIDDEN' });
  if (createsFulfillmentAuthority) return Object.freeze({ valid: false, reason: 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN' });
  if (createsLocationAuthority) return Object.freeze({ valid: false, reason: 'DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN' });
  if (mutatesStockOutsideInventory) return Object.freeze({ valid: false, reason: 'STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN' });
  if (mutatesFulfillmentOutsideCore) return Object.freeze({ valid: false, reason: 'FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN' });
  if (logisticsExecutesWarehouse) return Object.freeze({ valid: false, reason: 'LOGISTICS_MUST_NOT_EXECUTE_WAREHOUSE' });
  return Object.freeze({ valid: true, reason: 'HUB_DEPOT_BOUNDARY_VALIDATED' });
}

export function logisticsHubDepotContract() {
  return Object.freeze({
    version: LOGISTICS_HUB_DEPOT_CONTRACT_VERSION,
    node_types: NODE_TYPES,
    location_authority: 'locations',
    warehouse_authority: 'warehouse',
    inventory_authority: 'inventory',
    fulfillment_authority: 'existing_core_fulfillment',
    logistics_authority: 'logistics_movement_coordination',
    persistence: 'existing_domain_state_only',
    duplicate_location_authority: false,
    duplicate_inventory_ledger: false,
    duplicate_fulfillment_authority: false,
    logistics_stock_authority: false,
    logistics_warehouse_execution: false,
  });
}
