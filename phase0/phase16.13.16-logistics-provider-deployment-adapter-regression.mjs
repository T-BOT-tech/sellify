import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executePlatformAdapter } from '../app/src/platform/adapter-framework.js';
import {
  defineLogisticsProviderDeploymentAdapter,
  logisticsProviderDeploymentAdapterContract,
} from '../backend/lib/logistics/provider-deployment-adapter.js';

const deployment = defineLogisticsProviderDeploymentAdapter({
  id: 'deployment-logistics-adapter',
  provider: 'deployment-provider',
  provider_type: 'carrier',
  provider_contract_version: '1',
  operations: ['delivery', 'tracking'],
  executor: async (input, context) => ({
    provider_id: input.provider_id,
    operation: input.operation,
    result_status: 'in_progress',
    adapter_id: context.adapter.id,
  }),
}, { replace: true });

assert.equal(deployment.contract_version, '1.0');
assert.equal(deployment.adapter.capability, 'logistics.operations');
assert.equal(deployment.adapter.status, 'active');
assert.equal(deployment.binding.adapter_id, 'deployment-logistics-adapter');
assert.equal(deployment.binding.provider_id, 'deployment-provider');
assert.equal(deployment.credential_storage, false);
assert.equal(deployment.transport_ownership, false);

const result = await executePlatformAdapter('deployment-logistics-adapter', {
  provider_id: 'deployment-provider',
  operation: 'delivery',
});
assert.equal(result.provider_id, 'deployment-provider');
assert.equal(result.operation, 'delivery');
assert.equal(result.adapter_id, 'deployment-logistics-adapter');

await assert.rejects(
  () => defineLogisticsProviderDeploymentAdapter({
    id: 'inactive-deployment-adapter',
    provider: 'inactive-provider',
    operations: ['delivery'],
    status: 'deferred',
    executor: async () => ({}),
  }, { replace: true }),
  /must be active/,
);

await assert.rejects(
  () => defineLogisticsProviderDeploymentAdapter({
    id: 'credential-bearing-deployment-adapter',
    provider: 'credential-provider',
    operations: ['delivery'],
    credentials: 'must-not-cross-boundary',
    executor: async () => ({}),
  }, { replace: true }),
  /cannot contain credentials/,
);

const source = await readFile(
  new URL('../backend/lib/logistics/provider-deployment-adapter.js', import.meta.url),
  'utf8',
);
assert.match(source, /defineLogisticsProviderAdapter/);
assert.match(source, /bindLogisticsProviderExecutionAdapter/);
assert.doesNotMatch(source, /fetch\s*\(|process\.env|sqlite|apiKey|password/);

const contract = logisticsProviderDeploymentAdapterContract();
assert.equal(contract.phase, '16.13.16');
assert.equal(contract.adapter_authority, 'existing_platform_adapter_registry');
assert.equal(contract.execution_authority, 'existing_platform_adapter_execution_delegate_map');
assert.equal(contract.provider_registry, false);
assert.equal(contract.credential_storage, false);
assert.equal(contract.transport_ownership, false);
assert.equal(contract.persistence, 'none');
assert.equal(contract.authorization, 'existing_authorization');
assert.equal(contract.transaction_authority, 'existing_domain_transaction');
assert.equal(contract.fulfillment_authority, 'backend/lib/store-sqlite.js');
assert.equal(contract.routing_authority, false);
assert.equal(contract.callback_store, false);
assert.equal(contract.retry_engine, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);

console.log('Phase 16.13.16 Logistics provider deployment adapter contract: PASS');
