import assert from 'node:assert/strict';
import {
  normalizeLogisticsHubDepotNode,
  validateLogisticsHubDepotComposition,
  assertLogisticsHubDepotBoundary,
  logisticsHubDepotContract,
} from '../app/src/verticals/logistics/hub-depot-contract.js';

const contract = logisticsHubDepotContract();
assert.equal(contract.version, '1.0');
assert.deepEqual(contract.node_types, ['HUB', 'DEPOT', 'HANDOFF_POINT']);
assert.equal(contract.location_authority, 'locations');
assert.equal(contract.warehouse_authority, 'warehouse');
assert.equal(contract.inventory_authority, 'inventory');
assert.equal(contract.fulfillment_authority, 'existing_core_fulfillment');
assert.equal(contract.logistics_authority, 'logistics_movement_coordination');
assert.equal(contract.duplicate_location_authority, false);
assert.equal(contract.duplicate_inventory_ledger, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.logistics_stock_authority, false);

assert.deepEqual(
  normalizeLogisticsHubDepotNode({
    id: 'hub-1',
    type: 'hub',
    location_ref: 'location-1',
    organization_id: 'org-1',
    warehouse_ref: 'warehouse-1',
    fulfillment_ref: 'fulfillment-1',
  }),
  {
    id: 'hub-1',
    type: 'HUB',
    location_ref: 'location-1',
    organization_id: 'org-1',
    warehouse_ref: 'warehouse-1',
    fulfillment_ref: 'fulfillment-1',
  },
);

assert.throws(
  () => normalizeLogisticsHubDepotNode({
    id: 'node-1',
    type: 'ROUTE',
    location_ref: 'location-1',
    organization_id: 'org-1',
  }),
  /Unsupported hub/depot node type/,
);

const base = {
  organizationId: 'org-1',
  node: { id: 'hub-1', type: 'hub', location_ref: 'location-1', organization_id: 'org-1' },
  warehouse: { authority: 'warehouse' },
  inventory: { authority: 'inventory' },
  fulfillment: { authority: 'existing_core_fulfillment' },
  logistics: { authority: 'logistics_movement_coordination' },
};
assert.equal(validateLogisticsHubDepotComposition(base).valid, true);
assert.equal(
  validateLogisticsHubDepotComposition({ ...base, node: { ...base.node, organization_id: 'org-2' } }).reason,
  'HUB_DEPOT_ORGANIZATION_SCOPE_VIOLATION',
);
assert.equal(
  validateLogisticsHubDepotComposition({ ...base, inventory: { authority: 'logistics' } }).reason,
  'INVENTORY_AUTHORITY_REQUIRED',
);
assert.equal(
  validateLogisticsHubDepotComposition({ ...base, fulfillment: { authority: 'logistics' } }).reason,
  'FULFILLMENT_AUTHORITY_REQUIRED',
);

assert.deepEqual(
  assertLogisticsHubDepotBoundary(),
  { valid: true, reason: 'HUB_DEPOT_BOUNDARY_VALIDATED' },
);
assert.equal(
  assertLogisticsHubDepotBoundary({ createsInventoryLedger: true }).reason,
  'DUPLICATE_INVENTORY_LEDGER_FORBIDDEN',
);
assert.equal(
  assertLogisticsHubDepotBoundary({ createsFulfillmentAuthority: true }).reason,
  'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN',
);
assert.equal(
  assertLogisticsHubDepotBoundary({ createsLocationAuthority: true }).reason,
  'DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN',
);
assert.equal(
  assertLogisticsHubDepotBoundary({ mutatesStockOutsideInventory: true }).reason,
  'STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN',
);
assert.equal(
  assertLogisticsHubDepotBoundary({ mutatesFulfillmentOutsideCore: true }).reason,
  'FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN',
);
assert.equal(
  assertLogisticsHubDepotBoundary({ logisticsExecutesWarehouse: true }).reason,
  'LOGISTICS_MUST_NOT_EXECUTE_WAREHOUSE',
);

console.log('L14 Hub / Depot Coordination Boundary Regression: PASS');
