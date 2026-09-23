import assert from 'node:assert/strict';
import {
  defineLogisticsProviderCapability,
  evaluateLogisticsProviderCapability,
  logisticsProviderCapabilityContract,
} from '../app/src/verticals/logistics/provider-capability-contract.js';

const capability = defineLogisticsProviderCapability({
  provider_id: 'provider-a',
  capabilities: ['delivery', 'tracking', 'proof_of_delivery'],
  status: 'AVAILABLE',
  source: 'provider',
  evidence_mode: 'declared',
});
assert.equal(capability.provider_id, 'provider-a');
assert.equal(capability.execution, 'none');
assert.equal(capability.persistence, 'none');
assert.equal(capability.provider_selection, false);

const feasible = evaluateLogisticsProviderCapability(
  { capabilities: ['delivery', 'tracking'] },
  capability,
);
assert.equal(feasible.result, 'FEASIBLE');

const missing = evaluateLogisticsProviderCapability(
  { capabilities: ['delivery', 'returns'] },
  capability,
);
assert.equal(missing.result, 'NOT_FEASIBLE');
assert.deepEqual(missing.missing_capabilities, ['returns']);

const unknown = evaluateLogisticsProviderCapability(
  { capabilities: ['delivery'] },
  { provider_id: 'provider-b', capabilities: [], status: 'UNKNOWN', source: 'adapter' },
);
assert.equal(unknown.result, 'UNKNOWN');

assert.throws(() => defineLogisticsProviderCapability({
  provider_id: 'provider-a', capabilities: ['delivery'], credentials: 'secret',
}), /cannot contain credentials/);
assert.equal(logisticsProviderCapabilityContract().authorization_authority, 'backend/lib/authorization.js');
assert.equal(logisticsProviderCapabilityContract().fulfillment_authority, 'app/src/logistics/fulfillment.js');

console.log('Phase 16.13.2 Logistics Provider Capability Contract: PASS');
