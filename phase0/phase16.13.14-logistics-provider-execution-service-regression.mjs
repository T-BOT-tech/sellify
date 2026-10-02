import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  executeLogisticsProviderExecution,
  logisticsProviderExecutionServiceContract,
} from '../backend/lib/logistics/provider-execution-service.js';
import { registerPlatformAdapter, registerPlatformAdapterExecution } from '../app/src/platform/adapter-framework.js';

registerPlatformAdapter({
  id: 'service-provider-adapter',
  capability: 'logistics.operations',
  provider: 'provider-service',
  operations: ['delivery'],
  status: 'active',
}, { replace: true });

registerPlatformAdapterExecution('service-provider-adapter', async (input) => ({
  provider_id: input.provider_id,
  operation: input.operation,
  result_status: 'delivered',
  tracking: { status: 'delivered', occurred_at: '2026-10-02T00:00:00Z' },
  callback_id: 'service-callback-1',
}));

const handoff = {
  operation: 'delivery',
  selected_provider_id: 'provider-service',
  adapter_id: 'service-provider-adapter',
  provider_type: 'courier',
  authorization: { authorized: true, reference: 'auth-service-1' },
  transaction: { reference: 'txn-service-1', authority: 'existing_domain_transaction' },
};

// Duplicate callback path is exercised end-to-end through the server service.
// It must stop before canonical mutation, so this regression remains isolated
// from a live tenant/order database while still proving the service composes
// the existing execution bridge.
const duplicate = await executeLogisticsProviderExecution({
  handoff,
  chatId: 'tenant-service',
  serverOrderId: 'order-service',
  actor: { userId: 'user-service', role: 'logistics_manager' },
  locationId: 'location-service',
  idempotencyKey: 'provider-service-duplicate-1',
  processedCallbackIds: ['service-callback-1'],
});

assert.equal(duplicate.disposition, 'DUPLICATE');
assert.equal(duplicate.server_execution, 'sellify_backend_composition_boundary');
assert.equal(duplicate.canonical_application, null);
assert.equal(duplicate.duplicate_fulfillment_authority, false);
assert.equal(duplicate.duplicate_inventory_authority, false);
assert.equal(duplicate.payment_mutation, false);
assert.equal(duplicate.settlement_mutation, false);

await assert.rejects(
  () => executeLogisticsProviderExecution({
    handoff,
    chatId: 'tenant-service',
    serverOrderId: 'order-service',
    actor: { userId: 'user-service' },
    idempotencyKey: 'provider-service-missing-location',
    invokeProvider: async () => ({
      provider_id: 'provider-service',
      operation: 'delivery',
      result_status: 'delivered',
      tracking: { status: 'delivered', occurred_at: '2026-10-02T00:00:00Z' },
      callback_id: 'service-callback-2',
    }),
  }),
  /locationId/,
);

const source = await readFile(new URL('../backend/lib/logistics/provider-execution-service.js', import.meta.url), 'utf8');
assert.match(source, /executeLogisticsProviderExecutionBridge/);
assert.match(source, /applyLogisticsProviderCanonicalResult/);
assert.match(source, /canonicalApplicationContext/);
assert.match(source, /existing_domain_state_and_outbox_only/);

const contract = logisticsProviderExecutionServiceContract();
assert.equal(contract.phase, '16.13.14');
assert.equal(contract.fulfillment_authority, 'backend/lib/store-sqlite.js');
assert.equal(contract.canonical_application, 'backend/lib/logistics/provider-execution-application.js');
assert.equal(contract.persistence, 'existing_domain_state_and_outbox_only');
assert.equal(contract.credential_storage, false);
assert.equal(contract.provider_registry, false);
assert.equal(contract.callback_store, false);
assert.equal(contract.retry_engine, false);
assert.equal(contract.routing_authority, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);

console.log('Phase 16.13.14 Logistics provider execution service boundary: PASS');
