import assert from 'node:assert/strict';
import {
  normalizeLogisticsProviderCallback,
  logisticsProviderCallbackContract,
} from '../app/src/verticals/logistics/provider-callback-contract.js';

const callback = normalizeLogisticsProviderCallback({
  providerId: 'carrier-a',
  callbackId: 'cb-123',
  operation: 'delivery',
  resultStatus: 'delivered',
  transactionReference: 'order-123',
  tracking: { tracking_reference: 'TRK-123' },
  proof: { type: 'photo', reference: 'proof-123' },
});

assert.equal(callback.contract_version, '1.0');
assert.equal(callback.provider_id, 'carrier-a');
assert.equal(callback.callback_id, 'cb-123');
assert.equal(callback.result_status, 'delivered');
assert.equal(callback.execution_authority, 'existing_provider_execution_bridge');
assert.equal(callback.canonical_mutation_authority, 'existing_domain_transaction');

assert.throws(() => normalizeLogisticsProviderCallback({
  providerId: 'carrier-a',
  callbackId: 'cb-124',
  operation: 'delivery',
  resultStatus: 'unknown',
  transactionReference: 'order-123',
}), /Unsupported Logistics provider callback result status/);

assert.throws(() => normalizeLogisticsProviderCallback({
  providerId: 'carrier-a',
  callbackId: 'cb-125',
  operation: 'delivery',
  resultStatus: 'delivered',
}), /transaction_reference is required/);

const contract = logisticsProviderCallbackContract();
assert.equal(contract.transport, 'deployment_supplied');
assert.equal(contract.authentication, 'deployment_supplied_existing_authorization_boundary');
assert.equal(contract.persistence, 'none');
assert.equal(contract.callback_store, false);
assert.equal(contract.credential_storage, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.payment_mutation, false);
assert.equal(contract.settlement_mutation, false);

console.log('Phase 16.13.18 Logistics provider callback boundary: PASS');
