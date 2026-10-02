import assert from 'node:assert/strict';
import {
  executeLogisticsProviderExecutionBridge,
  logisticsProviderExecutionBridgeContract,
} from '../app/src/verticals/logistics/provider-execution-bridge-contract.js';
import { registerPlatformAdapter } from '../app/src/platform/adapter-framework.js';

registerPlatformAdapter({
  id: 'bridge-provider-adapter',
  capability: 'logistics.operations',
  provider: 'provider-bridge',
  operations: ['delivery', 'tracking', 'cross_border'],
}, { replace: true });

const handoff = {
  operation: 'delivery',
  selected_provider_id: 'provider-bridge',
  adapter_id: 'bridge-provider-adapter',
  provider_type: 'courier',
  authorization: { authorized: true, reference: 'auth-bridge-1' },
  transaction: { reference: 'txn-bridge-1', authority: 'existing_domain_transaction' },
};

let providerCalls = 0;
let canonicalCalls = 0;

const applied = executeLogisticsProviderExecutionBridge({
  handoff,
  currentStatus: 'in_progress',
  invokeProvider(input) {
    providerCalls += 1;
    assert.equal(input.provider_id, 'provider-bridge');
    assert.equal(input.operation, 'delivery');
    return {
      provider_id: 'provider-bridge',
      operation: 'delivery',
      result_status: 'delivered',
      callback_id: 'callback-bridge-1',
    };
  },
  applyCanonicalResult(result) {
    canonicalCalls += 1;
    assert.equal(result.canonical_result, 'fulfillment_delivered');
    return { accepted: true, transaction_reference: 'txn-bridge-1' };
  },
});

assert.equal(applied.disposition, 'APPLY');
assert.equal(applied.external_execution, true);
assert.equal(applied.provider_result.result_status, 'delivered');
assert.equal(applied.reliability.apply, true);
assert.equal(applied.canonical_application.accepted, true);
assert.equal(providerCalls, 1);
assert.equal(canonicalCalls, 1);
assert.equal(applied.persistence, 'existing_domain_state_and_outbox_only');

const duplicate = executeLogisticsProviderExecutionBridge({
  handoff,
  currentStatus: 'in_progress',
  processedCallbackIds: ['callback-bridge-2'],
  invokeProvider() {
    return {
      provider_id: 'provider-bridge',
      operation: 'delivery',
      result_status: 'delivered',
      callback_id: 'callback-bridge-2',
    };
  },
  applyCanonicalResult() {
    throw new Error('duplicate result must not mutate canonical state');
  },
});
assert.equal(duplicate.disposition, 'DUPLICATE');
assert.equal(duplicate.reliability.apply, false);
assert.equal(duplicate.canonical_result, null);
assert.equal(duplicate.canonical_application, null);

assert.throws(() => executeLogisticsProviderExecutionBridge({
  handoff: { ...handoff, selected_provider_id: 'other-provider' },
  invokeProvider() {
    return { provider_id: 'provider-bridge', operation: 'delivery', result_status: 'delivered', callback_id: 'cb-mismatch' };
  },
  applyCanonicalResult() {},
}), /adapter provider must match/);

assert.throws(() => executeLogisticsProviderExecutionBridge({
  handoff,
  invokeProvider() {
    return { provider_id: 'wrong-provider', operation: 'delivery', result_status: 'delivered', callback_id: 'cb-provider-mismatch' };
  },
  applyCanonicalResult() {},
}), /provider result does not match selected provider/);

assert.throws(() => executeLogisticsProviderExecutionBridge({
  handoff: { ...handoff, operation: 'cross_border' },
  invokeProvider() {
    return { provider_id: 'provider-bridge', operation: 'delivery', result_status: 'delivered', callback_id: 'cb-operation-mismatch' };
  },
  applyCanonicalResult() {},
}), /provider result operation does not match handoff/);

const contract = logisticsProviderExecutionBridgeContract();
assert.equal(contract.provider_registry, false);
assert.equal(contract.callback_store, false);
assert.equal(contract.retry_engine, false);
assert.equal(contract.routing_authority, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.fulfillment_authority, 'app/src/logistics/fulfillment.js');

console.log('Phase 16.13.12 Logistics provider execution bridge: PASS');
