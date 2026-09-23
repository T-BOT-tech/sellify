import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRestaurantTableContext, getRestaurantTableContexts, restaurantTableLocationContract } from '../app/src/verticals/restaurant/table-integration.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tablesPath = path.join(root, 'app/src/restaurant/tables.js');
const locationsPath = path.join(root, 'app/src/warehouse/locations.js');
const bridgePath = path.join(root, 'app/src/verticals/restaurant/table-integration.js');

assert(fs.existsSync(tablesPath));
assert(fs.existsSync(locationsPath));
assert(fs.existsSync(bridgePath));
const tables = fs.readFileSync(tablesPath, 'utf8');
const locations = fs.readFileSync(locationsPath, 'utf8');
assert.match(tables, /export let restaurantTables/);
assert.match(tables, /export function saveTables/);
assert.match(tables, /export function cycleTableStatus/);
assert.match(locations, /export function getActiveOrganizationLocation/);
assert.match(locations, /export function selectOrganizationLocation/);

const contract = restaurantTableLocationContract();
assert.equal(contract.table_authority, 'app/src/restaurant/tables.js');
assert.equal(contract.location_authority, 'app/src/warehouse/locations.js');
assert.equal(contract.core_location_registry, 'state.organizationLocations');
assert.equal(contract.organization_scope, 'config.chatId');
assert.equal(contract.selected_location, 'config.locationId');
assert.equal(contract.duplicate_authority, false);

const locationsFixture = [
  { id: 'loc-1', organization_id: 'org-1', name: 'Main Dining Room', status: 'active' },
  { id: 'loc-2', organization_id: 'org-2', name: 'Other Tenant', status: 'active' },
  { id: 'loc-3', organization_id: 'org-1', name: 'Closed Room', status: 'inactive' },
];
const context = getRestaurantTableContext(
  { id: 'table-1', number: 1 },
  { organizationId: 'org-1', locationId: 'loc-1', organizationLocations: locationsFixture }
);
assert.deepEqual(context, {
  table_id: 'table-1', table_number: 1, organization_id: 'org-1', location_id: 'loc-1',
  location_name: 'Main Dining Room', core_location_type: 'organization_location'
});
assert.equal(getRestaurantTableContexts(
  [{ id: 'table-1', number: 1 }, { id: 'table-2', number: 2 }],
  { organizationId: 'org-1', locationId: 'loc-1', organizationLocations: locationsFixture }
).length, 2);
assert.throws(() => getRestaurantTableContext(
  { id: 'table-1', number: 1 },
  { organizationId: 'org-1', locationId: 'loc-2', organizationLocations: locationsFixture }
), /different organization/);
assert.throws(() => getRestaurantTableContext(
  { id: 'table-1', number: 1 },
  { organizationId: 'org-1', locationId: 'loc-3', organizationLocations: locationsFixture }
), /not an active Core location/);
assert.throws(() => getRestaurantTableContext(
  { id: 'table-1', number: 1 },
  { organizationId: 'org-1', locationId: 'missing', organizationLocations: locationsFixture }
), /not an active Core location/);

console.log('Phase 13.8.2 Restaurant Tables Integration Regression: PASS');
