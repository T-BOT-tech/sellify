import assert from 'node:assert/strict';
import {
  defineLogisticsNetworkIntegration,
  logisticsNetworkIntegrationContract,
} from '../app/src/verticals/logistics/network-integration-contract.js';

const integration = defineLogisticsNetworkIntegration({
  id: 'logistics-carrier-a',
  provider_id: 'carrier-a',
  provider_type: 'carrier',
  source: 'carrier-a',
  target: 'sellify-logistics',
  adapter_id: 'carrier-a-v1',
  operations: ['pickup', 'delivery', 'tracking'],
  direction: 'bidirectional',
  status: 'declared',
  scope: 'tenant_scoped',
});

assert.equal(integration.capability, 'logistics.operations');
assert.equal(integration.provider_id, 'carrier-a');
assert.equal(integration.provider_type, 'carrier');
assert.equal(integration.direction, 'bidirectional');
assert.equal(integration.execution, 'compose_and_delegate');
assert.equal(integration.provider_execution, 'adapter_delegated');
assert.equal(integration.persistence, 'none');
assert.equal(integration.authorization, 'existing_authorization');
assert.equal(integration.transactionAuthority, 'existing_domain_transaction');
assert.equal(integration.canonical_authority, 'logistics');

assert.throws(
  () => defineLogisticsNetworkIntegration({
    provider_id: 'carrier-a',
    provider_type: 'carrier',
    adapter_id: 'carrier-a-v1',
    operations: ['delivery'],
    credentials: { token: 'must-not-cross' },
  }),
  /forbidden ownership|credentials/,
);

const contract = logisticsNetworkIntegrationContract();
assert.equal(contract.capability, 'logistics.operations');
assert.equal(contract.routing_authority, 'not_created');
assert.equal(contract.shipment_ledger, 'not_created');
assert.equal(contract.provider_registry, 'not_created');
assert.equal(contract.duplicate_domain_authority, false);

console.log('Phase 16.13.11 Logistics Network Integration Regression: PASS');
