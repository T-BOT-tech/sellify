import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerPlatformAdapter, executePlatformAdapter } from '../app/src/platform/adapter-framework.js';
import {
  bindLogisticsProviderExecutionAdapter,
  logisticsProviderExecutionRuntimeContract,
} from '../backend/lib/logistics/provider-execution-runtime.js';

registerPlatformAdapter({
  id: 'runtime-logistics-adapter',
  capability: 'logistics.operations',
  provider: 'runtime-provider',
  operations: ['delivery'],
  status: 'active',
}, { replace: true });

const binding = bindLogisticsProviderExecutionAdapter(
  'runtime-logistics-adapter',
  async (input, context) => ({
    provider_id: input.provider_id,
    operation: input.operation,
    result_status: 'in_progress',
    runtime_adapter_id: context.adapter.id,
  }),
);

assert.equal(binding.adapter_id, 'runtime-logistics-adapter');
assert.equal(binding.provider_id, 'runtime-provider');
assert.equal(binding.execution, 'deployment_supplied_process_local_delegate');
assert.equal(binding.credential_storage, false);
assert.equal(binding.transport_ownership, false);

const execution = await executePlatformAdapter('runtime-logistics-adapter', {
  provider_id: 'runtime-provider',
  operation: 'delivery',
});
assert.equal(execution.provider_id, 'runtime-provider');
assert.equal(execution.runtime_adapter_id, 'runtime-logistics-adapter');

await assert.rejects(
  () => bindLogisticsProviderExecutionAdapter('missing-runtime-adapter', async () => ({})),
  /unknown platform adapter/,
);

registerPlatformAdapter({
  id: 'runtime-deferred-adapter',
  capability: 'logistics.operations',
  provider: 'runtime-deferred-provider',
  operations: ['delivery'],
  status: 'deferred',
}, { replace: true });

await assert.rejects(
  () => bindLogisticsProviderExecutionAdapter('runtime-deferred-adapter', async () => ({})),
  /not active/,
);

registerPlatformAdapter({
  id: 'runtime-non-logistics-adapter',
  capability: 'payment',
  provider: 'runtime-payment-provider',
  operations: ['charge'],
  status: 'active',
}, { replace: true });

await assert.rejects(
  () => bindLogisticsProviderExecutionAdapter('runtime-non-logistics-adapter', async () => ({})),
  /not a Logistics adapter/,
);

const source = await readFile(new URL('../backend/lib/logistics/provider-execution-runtime.js', import.meta.url), 'utf8');
assert.match(source, /registerPlatformAdapterExecution/);
assert.match(source, /existing_platform_adapter_execution_delegate_map/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /database|sqlite|credential|apiKey|password/);

const contract = logisticsProviderExecutionRuntimeContract();
assert.equal(contract.phase, '16.13.15');
assert.equal(contract.adapter_registry, 'existing_platform_adapter_registry');
assert.equal(contract.execution_registry, 'existing_platform_adapter_execution_delegate_map');
assert.equal(contract.provider_registry, false);
assert.equal(contract.credential_storage, false);
assert.equal(contract.transport_ownership, false);
assert.equal(contract.persistence, 'none');
assert.equal(contract.transaction_authority, 'existing_domain_transaction');
assert.equal(contract.fulfillment_authority, 'backend/lib/store-sqlite.js');
assert.equal(contract.routing_authority, false);
assert.equal(contract.callback_store, false);
assert.equal(contract.retry_engine, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);

console.log('Phase 16.13.15 Logistics provider execution runtime binding: PASS');
