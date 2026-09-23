import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getWarehouseConfiguration, isWarehouseConfiguration, warehouseConfigurationContract } from '../app/src/verticals/warehouse/config-contract.js';

const normalized = getWarehouseConfiguration({ config: { warehouseEnabled: true, organizationId: 'org-1', locationId: 'loc-1' } });
assert.equal(normalized.warehouse_enabled, true);
assert.equal(normalized.organization_id, 'org-1');
assert.equal(normalized.location_id, 'loc-1');
assert.equal(isWarehouseConfiguration(normalized), true);
assert.equal(Object.isFrozen(normalized), true);

const defaults = getWarehouseConfiguration({ config: {} });
assert.equal(defaults.warehouse_enabled, false);
assert.equal(defaults.organization_id, null);
assert.equal(defaults.location_id, null);

assert.throws(() => getWarehouseConfiguration(), /config is required/);

const metadata = warehouseConfigurationContract();
assert.equal(metadata.feature_flag, 'config.warehouseEnabled');
assert.equal(metadata.default_warehouse_enabled, false);
assert.equal(metadata.configuration_authority, 'app/src/state.js#config');
assert.equal(metadata.persistence_authority, 'STORAGE_KEYS.config');
assert.equal(metadata.organization_scope, 'config.organizationId');
assert.equal(metadata.selected_location, 'config.locationId');
assert.equal(metadata.canonical_locations, 'state.organizationLocations');
assert.equal(metadata.legacy_storage_bins, 'state.warehouseLocations');
assert.equal(metadata.duplicate_configuration_authority, false);
assert.equal(metadata.persistence, 'existing_config_store_only');

const stateSource = fs.readFileSync(new URL('../app/src/state.js', import.meta.url), 'utf8');
assert.match(stateSource, /export let config = loadJSON\(STORAGE_KEYS\.config/);
assert.match(stateSource, /warehouseEnabled: false/);
assert.match(stateSource, /if \(config\.warehouseEnabled === undefined\) config\.warehouseEnabled = false/);
assert.match(stateSource, /export let organizationLocations =/);
assert.match(stateSource, /export let warehouseLocations =/);
assert.notEqual(stateSource.indexOf('organizationLocations'), stateSource.indexOf('warehouseLocations'));

console.log('Phase 13.9.9 Warehouse Configuration Regression: PASS');
