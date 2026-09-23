import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getVerticalPackConfiguration,
  verticalConfigurationContract,
  isVerticalPackConfiguration,
} from '../app/src/verticals/configuration.js';

const base = {
  businessModel: 'retail',
  niche: 'grocery',
  wholesaleEnabled: false,
  volumeDiscountEnabled: false,
  warehouseEnabled: false,
  logisticsEnabled: false,
  organizationId: 'ORG-1',
  locationId: 'LOC-1',
};

const warehouse = getVerticalPackConfiguration({
  packId: 'warehouse',
  config: base,
  organizationConfig: { warehouseEnabled: true, organizationId: 'ORG-1' },
  locationConfig: { warehouseEnabled: false, organizationId: 'ORG-1', locationId: 'LOC-1' },
  overrides: { warehouseEnabled: true },
  organizationId: 'ORG-1',
  locationId: 'LOC-1',
});
assert.equal(warehouse.enabled, true);
assert.equal(warehouse.configuration.warehouseEnabled, true);
assert.equal(isVerticalPackConfiguration(warehouse), true);
assert.equal(Object.isFrozen(warehouse), true);

const restaurant = getVerticalPackConfiguration({
  packId: 'restaurant',
  config: { ...base, businessModel: 'retail' },
  organizationConfig: { businessModel: 'restaurant' },
  locationConfig: {},
  organizationId: 'ORG-1',
});
assert.equal(restaurant.enabled, true);

const logistics = getVerticalPackConfiguration({ packId: 'logistics', config: base });
assert.equal(logistics.enabled, false);

const agriculture = getVerticalPackConfiguration({ packId: 'agriculture', config: base });
assert.equal(agriculture.enabled, null);

assert.throws(
  () => getVerticalPackConfiguration({ packId: 'unknown', config: base }),
  /Unknown vertical pack/
);
assert.throws(
  () => getVerticalPackConfiguration({
    packId: 'warehouse', config: base,
    organizationConfig: { warehouseEnabled: true, organizationId: 'ORG-2' },
    organizationId: 'ORG-1',
  }),
  /organization scope mismatch/
);
assert.throws(
  () => getVerticalPackConfiguration({
    packId: 'warehouse', config: base,
    locationConfig: { warehouseEnabled: true, organizationId: 'ORG-1', locationId: 'LOC-2' },
    organizationId: 'ORG-1', locationId: 'LOC-1',
  }),
  /location scope mismatch/
);

const contract = verticalConfigurationContract();
assert.equal(contract.configuration_authority, 'app/src/state.js#config');
assert.equal(contract.persistence_authority, 'STORAGE_KEYS.config');
assert.deepEqual(contract.precedence, [
  'defaults', 'existing_config', 'organization_override',
  'location_override', 'runtime_override',
]);
assert.equal(contract.packs.agriculture.activation, 'declarative_only');
assert.equal(contract.packs.agriculture.feature_flag, null);
assert.equal(contract.packs.restaurant.feature_flag, 'businessModel');
assert.equal(contract.packs.warehouse.feature_flag, 'warehouseEnabled');
assert.equal(contract.packs.logistics.feature_flag, 'logisticsEnabled');
assert.equal(contract.duplicate_configuration_authority, false);
assert.equal(contract.persistence, 'existing_config_store_only');

const stateSource = fs.readFileSync(new URL('../app/src/state.js', import.meta.url), 'utf8');
assert.match(stateSource, /export let config = loadJSON\(STORAGE_KEYS\.config/);
assert.match(stateSource, /warehouseEnabled: false/);
assert.match(stateSource, /logisticsEnabled: false/);
assert.match(stateSource, /businessModel: 'retail'/);

const warehouseContractSource = fs.readFileSync(
  new URL('../app/src/verticals/warehouse/config-contract.js', import.meta.url), 'utf8'
);
const logisticsContractSource = fs.readFileSync(
  new URL('../app/src/verticals/logistics/config-contract.js', import.meta.url), 'utf8'
);
assert.match(warehouseContractSource, /STORAGE_KEYS\.config/);
assert.match(logisticsContractSource, /STORAGE_KEYS\.config/);

const source = fs.readFileSync(new URL('../app/src/verticals/configuration.js', import.meta.url), 'utf8');
assert.match(source, /app\/src\/state\.js#config/);
assert.match(source, /STORAGE_KEYS\.config/);
assert.match(source, /authorization_authority/);
assert.match(source, /event_outbox_authority/);
assert.doesNotMatch(source, /recordAuditEvent\(/);
assert.doesNotMatch(source, /authorize\(/);

console.log('Phase 13.12.13 Pack Configuration Regression: PASS');
console.log('Configuration precedence: defaults → existing config → organization → location → runtime');
console.log('Pack activation semantics: PASS');
console.log('Configuration scope isolation: PASS');
console.log('Existing configuration authority preserved: PASS');
console.log('No duplicate configuration / authorization / event authority: BLOCKED');
