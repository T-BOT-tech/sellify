import assert from 'node:assert/strict';
import { getLogisticsConfiguration, logisticsConfigurationContract } from '../app/src/verticals/logistics/config-contract.js';

const disabled = getLogisticsConfiguration({ config: {} });
assert.equal(disabled.logistics_enabled, false);
const enabled = getLogisticsConfiguration({ config: { logisticsEnabled: true, organizationId: 'ORG-1', locationId: 'LOC-1' } });
assert.deepEqual(enabled, {
  logistics_enabled: true, organization_id: 'ORG-1', location_id: 'LOC-1',
  authority: 'app/src/state.js#config', persistence: 'STORAGE_KEYS.config',
});
const contract = logisticsConfigurationContract();
assert.equal(contract.feature_flag, 'config.logisticsEnabled');
assert.equal(contract.configuration_authority, 'app/src/state.js#config');
assert.equal(contract.duplicate_configuration_authority, false);
console.log('Phase 13.10.5 Logistics Configuration Regression: PASS');
