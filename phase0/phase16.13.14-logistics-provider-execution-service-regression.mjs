import assert from 'node:assert/strict';
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

const result = await executeLogisticsProviderExecution({
  handoff,
  chatId: 'tenant-service',
  serverOrderId: 'order-service',
  actor: { userId: 'user-service', role: 'logistics_manager' },
  locationId: 'location-service',
  idempotencyKey: 'provider-service-delivered-1',
});

assert.equal(result.disposition, 'APPLY');
assert.equal(result.server_execution, 'sellify_backend_composition_boundary');
assert.equal(result.canonical_application_authority, 'backend/lib/store-sqlite.js');
assert.equal(result.canonical_application.canonical_result, 'fulfillment_delivered');
assert.equal(result.canonical_application.mutation_authority, 'existing_domain_transaction');
assert.equal(result.duplicate_fulfillment_authority, false);
assert.equal(result.duplicate_inventory_authority, false);
assert.equal(result.payment_mutation, false);
assert.equal(result.settlement_mutation, false);

const duplicate = await executeLogisticsProviderExecution({
  handoff,
  chatId: 'tenant-service',
  serverOrderId: 'order-service',
  actor: { userId: 'user-service', role: 'logistics_manager' },
  locationId: 'location-service',
  idempotencyKey: 'provider-service-delivered-2',
  processedCallbackIds: ['service-callback-2'],
  invokeProvider: async () => ({
    provider_id: 'provider-service',
    operation: 'delivery',
    result_status: 'delivered',
    tracking: { status: 'delivered', occurred_at: '2026-10-02T00:00:00Z' },
    callback_id: 'service-callback-2',
  }),
});
assert.equal(duplicate.disposition, 'DUPLICATE');
assert.equal(duplicate.canonical_application, null);

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
      callback_id: 'service-callback-3',
    }),
  }),
  /locationId/,
);

const contract = logisticsProviderExecutionServiceContract();
assert.equal(contract.phase, '16.13.14');
assert.equal(contract.fulfillment_authority, 'backend/lib/store-sqlite.js');
assert.equal(contract.persistence, 'existing_domain_state_and_outbox_only');
assert.equal(contract.credential_storage, false);
assert.equal(contract.provider_registry, false);
assert.equal(contract.callback_store, false);
assert.equal(contract.retry_engine, false);
assert.equal(contract.routing_authority, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);

console.log('Phase 16.13.14 Logistics provider execution service boundary: PASS');
