import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWarehouseLocationContext,
  getWarehouseLocationContexts,
  isWarehouseLocationContext,
  warehouseLocationBridgeContract,
} from '../app/src/verticals/warehouse/location-bridge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locationsPath = path.join(root, 'app/src/warehouse/locations.js');
const statePath = path.join(root, 'app/src/state.js');
const bridgePath = path.join(root, 'app/src/verticals/warehouse/location-bridge.js');

assert(fs.existsSync(locationsPath));
assert(fs.existsSync(statePath));
assert(fs.existsSync(bridgePath));

const locations = fs.readFileSync(locationsPath, 'utf8');
const state = fs.readFileSync(statePath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');

assert.match(locations, /export async function loadOrganizationLocations/);
assert.match(locations, /export function getActiveOrganizationLocation/);
assert.match(locations, /export function selectOrganizationLocation/);
assert.match(state, /organizationLocations = loadJSON/);
assert.match(state, /warehouseLocations = loadJSON/);
assert.match(bridge, /storage_bin_is_not_core_location/);

const locationsFixture = [
  { id: 'loc-1', organization_id: 'org-1', code: 'MAIN', name: 'Main Warehouse', type: 'WAREHOUSE', status: 'active' },
  { id: 'loc-2', organization_id: 'org-2', code: 'OTHER', name: 'Other Tenant', type: 'WAREHOUSE', status: 'active' },
  { id: 'loc-3', organization_id: 'org-1', code: 'CLOSED', name: 'Closed Warehouse', type: 'WAREHOUSE', status: 'inactive' },
];

const context = getWarehouseLocationContext({
  organizationId: 'org-1',
  locationId: 'loc-1',
  organizationLocations: locationsFixture,
});
assert.deepEqual(context, {
  organization_id: 'org-1',
  location_id: 'loc-1',
  location_code: 'MAIN',
  location_name: 'Main Warehouse',
  location_type: 'WAREHOUSE',
  location_status: 'active',
  core_location_type: 'organization_location',
});
assert.equal(isWarehouseLocationContext(context), true);

const contexts = getWarehouseLocationContexts(['loc-1'], {
  organizationId: 'org-1',
  organizationLocations: locationsFixture,
});
assert.equal(contexts.length, 1);
assert.equal(contexts[0].location_id, 'loc-1');

assert.throws(() => getWarehouseLocationContext({
  organizationId: 'org-1', locationId: 'loc-2', organizationLocations: locationsFixture,
}), /different organization/);
assert.throws(() => getWarehouseLocationContext({
  organizationId: 'org-1', locationId: 'loc-3', organizationLocations: locationsFixture,
}), /not an active Core location/);
assert.throws(() => getWarehouseLocationContext({
  organizationId: 'org-1', locationId: 'missing', organizationLocations: locationsFixture,
}), /not an active Core location/);
assert.throws(() => getWarehouseLocationContext({
  organizationId: 'org-1', locationId: '', organizationLocations: locationsFixture,
}), /non-empty string/);
assert.throws(() => getWarehouseLocationContexts('loc-1', {
  organizationId: 'org-1', organizationLocations: locationsFixture,
}), /must be an array/);

const contract = warehouseLocationBridgeContract();
assert.equal(contract.warehouse_location_authority, 'app/src/warehouse/locations.js');
assert.equal(contract.location_authority, 'core.locations');
assert.equal(contract.core_location_registry, 'state.organizationLocations');
assert.equal(contract.organization_scope, 'config.organizationId');
assert.equal(contract.selected_location, 'config.locationId');
assert.equal(contract.storage_bin_is_not_core_location, true);
assert.equal(contract.duplicate_authority, false);
assert.equal(contract.persistence, 'none');

console.log('Phase 13.9.5 Warehouse Location Bridge Regression: PASS');
