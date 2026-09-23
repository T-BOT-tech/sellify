import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const locationsSource = fs.readFileSync(path.join(root, 'app/src/warehouse/locations.js'), 'utf8');
const stateSource = fs.readFileSync(path.join(root, 'app/src/state.js'), 'utf8');
const constantsSource = fs.readFileSync(path.join(root, 'app/src/constants.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'app/src/warehouse/ui.js'), 'utf8');

assert.match(locationsSource, /warehouseLocations/);
assert.match(locationsSource, /saveWarehouseLocations/);
assert.match(locationsSource, /STORAGE_KEYS\.warehouseLocations/);
assert.match(stateSource, /export let warehouseLocations = loadJSON\(STORAGE_KEYS\.warehouseLocations, \[\]\)/);
assert.match(constantsSource, /warehouseLocations:\s*['"]ledger_warehouse_locations['"]/);
assert.match(uiSource, /Storage bins \(legacy\)/);
assert.match(uiSource, /warehouseLocations\.map/);

const { getLegacyWarehouseBins, isLegacyWarehouseBin, legacyWarehouseBinCompatibilityContract, isLegacyWarehouseBinCompatibilityContract } =
  await import('../app/src/verticals/warehouse/legacy-bin-compatibility.js');

const bins = [
  { id: 'bin-1', name: 'Shelf A' },
  { id: 'bin-2', name: 'Cold Room' },
  { id: '', name: 'Invalid' },
  { id: 'bin-3', name: '' },
];

assert.equal(isLegacyWarehouseBin(bins[0]), true);
assert.equal(isLegacyWarehouseBin(bins[2]), false);
assert.deepEqual(getLegacyWarehouseBins(bins), [
  { id: 'bin-1', name: 'Shelf A' },
  { id: 'bin-2', name: 'Cold Room' },
]);
assert.throws(() => getLegacyWarehouseBins(null), /warehouseLocations must be an array/);

const contract = legacyWarehouseBinCompatibilityContract();
assert.equal(isLegacyWarehouseBinCompatibilityContract(contract), true);
assert.equal(contract.merge_into_organization_locations, false);
assert.equal(contract.promote_to_canonical_location, false);
assert.equal(contract.migration_required, false);
assert.equal(contract.canonical_location_state, 'state.organizationLocations');
assert.equal(contract.canonical_location_selection, 'config.locationId');
assert.equal(contract.duplicate_authority, false);

console.log('Phase 13.9.12 Warehouse Legacy Bin Compatibility Regression: PASS');
