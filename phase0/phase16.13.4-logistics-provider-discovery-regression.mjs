import assert from 'node:assert/strict';
import {
  defineLogisticsProviderRegistration,
  registerLogisticsProvider,
  discoverRegisteredLogisticsProviders,
  resolveRegisteredLogisticsProvider,
  verifyLogisticsProviderCapabilityEvidence,
  logisticsProviderDiscoveryContract,
} from '../app/src/verticals/logistics/provider-discovery-contract.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

const contract = logisticsProviderDiscoveryContract();
check(contract.version === '1.0', 'version');
check(contract.registration_authority === 'existing platform adapter registry', 'existing registry authority');
check(contract.discovery === 'metadata_only', 'metadata only');
check(contract.persistence === 'none', 'no persistence');
check(contract.provider_selection === false, 'no provider selection');
check(contract.credential_storage === false, 'no credential storage');
check(contract.duplicate_provider_registry === false, 'no duplicate provider registry');

const registration = defineLogisticsProviderRegistration({
  provider_id: 'network-x', provider_type: 'carrier', display_name: 'Network X',
  adapter_id: 'logistics-network-x', capabilities: ['delivery', 'tracking'], geographies: ['ET'], status: 'declared',
});
check(registration.provider_id === 'network-x', 'provider id');
check(registration.adapter_id === 'logistics-network-x', 'adapter id');
check(registration.capabilities.length === 2, 'capabilities');
check(registration.persistence === 'none', 'registration persistence');

const registered = registerLogisticsProvider({
  provider_id: 'network-x', provider_type: 'carrier', display_name: 'Network X',
  adapter_id: 'logistics-network-x', capabilities: ['delivery', 'tracking'], geographies: ['ET'], status: 'declared',
});
check(registered.adapter.capability === 'logistics.operations', 'adapter canonical capability');
check(registered.adapter.provider === 'network-x', 'adapter provider');

const discovered = discoverRegisteredLogisticsProviders();
const found = discovered.find((item) => item.provider_id === 'network-x');
check(Boolean(found), 'registered provider discoverable');
check(found.discovery === 'metadata_only', 'discovery metadata only');
check(found.persistence === 'none', 'discovery no persistence');
check(found.provider_selection === false, 'discovery no selection');

const resolved = resolveRegisteredLogisticsProvider('logistics-network-x');
check(resolved.provider_id === 'network-x', 'resolved provider');
check(resolved.capabilities.includes('delivery'), 'resolved capability');
check(resolved.execution === 'deferred', 'resolved execution deferred');

const evidence = verifyLogisticsProviderCapabilityEvidence({
  provider_id: 'network-x', capabilities: ['delivery', 'tracking'], status: 'AVAILABLE', source: 'provider', evidence_mode: 'verified',
});
check(evidence.verified === true, 'verified evidence');
check(evidence.provider_selection === false, 'evidence cannot select');
check(evidence.execution === false, 'evidence cannot execute');

throwsCode(() => defineLogisticsProviderRegistration({ provider_id: 'x', provider_type: 'carrier', adapter_id: 'x', credentials: {} }), 'LOGISTICS_PROVIDER_DISCOVERY_INVALID', 'credentials rejected');
throwsCode(() => defineLogisticsProviderRegistration({ provider_id: 'x', provider_type: 'carrier', adapter_id: 'x', commercialTerms: {} }), 'LOGISTICS_PROVIDER_DISCOVERY_INVALID', 'commercial terms rejected');
throwsCode(() => defineLogisticsProviderRegistration({ provider_id: 'x', provider_type: 'carrier', adapter_id: 'x', database: {} }), 'LOGISTICS_PROVIDER_DISCOVERY_INVALID', 'database rejected');

console.log(`Phase 16.13.4 Logistics Provider Discovery Regression: ${pass} PASS / 0 FAIL`);
