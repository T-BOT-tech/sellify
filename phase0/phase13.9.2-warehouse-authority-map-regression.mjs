// Phase 13.9.2 — Warehouse Pack Authority Map Regression.
import assert from 'node:assert/strict';
import { WAREHOUSE_PACK, WAREHOUSE_BOUNDARY } from '../app/src/verticals/warehouse/pack.js';
import { WAREHOUSE_AUTHORITY_MAP, WAREHOUSE_AUTHORITY_MAP_VERSION, getWarehouseAuthority } from '../app/src/verticals/warehouse/authority-map.js';

assert.equal(WAREHOUSE_AUTHORITY_MAP_VERSION, '1.0');
assert.equal(WAREHOUSE_PACK.pack_id, 'warehouse');
assert.deepEqual(WAREHOUSE_BOUNDARY.bridges_to_core, {
  product: 'commerce',
  inventory_stock: 'inventory',
  inventory_movement: 'inventory',
  organization_location: 'locations',
  order: 'commerce',
  customer: 'customers',
  fulfillment: 'fulfillment',
  audit: 'audit',
});

const expectedOwners = {
  product: 'commerce',
  inventory_stock: 'inventory',
  inventory_movement: 'inventory',
  organization_location: 'locations',
  storage_bin: 'warehouse',
  order: 'commerce',
  customer: 'customers',
  fulfillment: 'fulfillment',
  audit: 'audit',
};

assert.deepEqual(Object.fromEntries(WAREHOUSE_AUTHORITY_MAP.map((entry) => [entry.concept, entry.owner])), expectedOwners);
assert.equal(WAREHOUSE_AUTHORITY_MAP.length, Object.keys(expectedOwners).length);

for (const entry of WAREHOUSE_AUTHORITY_MAP) {
  assert.ok(entry.direction);
  assert.ok(entry.conflict_policy);
  assert.ok(entry.reconciliation_policy);
  assert.ok(entry.owner);
}

assert.equal(getWarehouseAuthority('inventory_stock').owner, 'inventory');
assert.equal(getWarehouseAuthority('storage_bin').owner, 'warehouse');
assert.equal(getWarehouseAuthority('does_not_exist'), null);

assert.ok(Object.isFrozen(WAREHOUSE_AUTHORITY_MAP));
assert.ok(WAREHOUSE_AUTHORITY_MAP.every(Object.isFrozen));

for (const forbidden of WAREHOUSE_BOUNDARY.forbidden_parallel_authorities) {
  assert.ok(!WAREHOUSE_AUTHORITY_MAP.some((entry) => entry.concept.toLowerCase() === forbidden.toLowerCase()));
}

console.log('Phase 13.9.2 Warehouse Authority Map Regression: PASS');
