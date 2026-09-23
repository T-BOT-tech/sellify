import assert from 'node:assert/strict';
import {
  discoverPlatformCapabilities,
  discoverPlatformCapability,
  discoverCapabilityAction,
  discoverPlatformSurface,
  assertCapabilityDiscoveryRequest,
  platformCapabilityDiscoveryContract,
} from '../app/src/platform/capability-discovery.js';
import { registerPlatformAdapter } from '../app/src/platform/adapter-framework.js';
import { registerPlatformIntegration } from '../app/src/platform/integration-contract.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

const contract = platformCapabilityDiscoveryContract();
check(contract.version === '1.0', 'discovery version');
check(contract.execution === 'metadata_only', 'metadata only');
check(contract.persistence === 'none', 'no persistence');
check(contract.authorization === 'existing_authorization', 'existing authorization');
check(contract.transactionAuthority === 'existing_domain_transaction', 'existing transaction authority');
check(contract.sensitiveData === 'not_exposed', 'sensitive data not exposed');
check(contract.duplicateAuthority === false, 'no duplicate authority');
check(contract.duplicatePersistence === false, 'no duplicate persistence');
check(contract.duplicateEventStore === false, 'no duplicate event store');

const all = discoverPlatformCapabilities();
check(all.length >= 11, 'canonical capabilities discoverable');
check(all.some((item) => item.capability === 'commerce.orders'), 'orders discoverable');
check(all.every((item) => item.persistence === 'none'), 'all capabilities have no persistence');
check(all.every((item) => item.authorization === 'existing_authorization'), 'all use existing authorization');

const commerce = discoverPlatformCapability('commerce.orders');
check(commerce.authority === 'commerce', 'orders authority');
check(commerce.actions.includes('create'), 'orders create action');
check(commerce.execution === 'delegate_to_existing_authority', 'delegation execution');

const action = discoverCapabilityAction('commerce.orders', 'create');
check(action.action === 'create', 'action discovery');
check(action.authority === 'commerce', 'action authority');
check(action.persistence === 'none', 'action no persistence');

const filtered = discoverPlatformCapabilities({ authority: 'inventory' });
check(filtered.length === 1, 'authority filter');
check(filtered[0].capability === 'inventory.stock', 'inventory filter result');

registerPlatformAdapter({
  id: 'discovery-test-adapter', capability: 'commerce.orders', provider: 'discovery-provider',
  version: '1', operations: ['create'], status: 'declared', persistence: 'none',
  transactionAuthority: 'existing_domain_transaction', authorization: 'existing_authorization',
});
registerPlatformIntegration({
  id: 'discovery-test-integration', source: 'external', target: 'sellify', capability: 'commerce.orders',
  direction: 'inbound', operations: ['create'], adapterId: 'discovery-test-adapter',
  scope: 'tenant_scoped', status: 'declared',
});
const surface = discoverPlatformSurface();
check(surface.execution === 'none', 'surface never executes');
check(surface.persistence === 'none', 'surface no persistence');
check(surface.sensitiveData === 'not_exposed', 'surface sensitive data boundary');
check(surface.adapters.some((item) => item.id === 'discovery-test-adapter'), 'adapter metadata discoverable');
check(surface.integrations.some((item) => item.id === 'discovery-test-integration'), 'integration metadata discoverable');
check(!('credentials' in surface), 'credentials absent');
check(!('database' in surface), 'database absent');

check(assertCapabilityDiscoveryRequest({ capability: 'commerce.orders', action: 'create' }) === true, 'valid discovery request');
throwsCode(() => assertCapabilityDiscoveryRequest({ credentials: 'secret' }), 'PLATFORM_CAPABILITY_DISCOVERY_INVALID', 'credentials rejected');
throwsCode(() => assertCapabilityDiscoveryRequest({ database: 'db' }), 'PLATFORM_CAPABILITY_DISCOVERY_INVALID', 'database rejected');
throwsCode(() => discoverPlatformCapability('missing.capability'), 'PLATFORM_CAPABILITY_UNKNOWN', 'unknown capability rejected');
throwsCode(() => discoverCapabilityAction('commerce.orders', 'unknown'), 'PLATFORM_CAPABILITY_ACTION_UNSUPPORTED', 'unknown action rejected');

console.log(`Phase 16.5 Capability Discovery Regression: ${pass} PASS / 0 FAIL`);
