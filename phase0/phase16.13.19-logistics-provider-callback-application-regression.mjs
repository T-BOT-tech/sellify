import assert from 'node:assert/strict';
import {
  applyLogisticsProviderCallback,
  logisticsProviderCallbackApplicationContract,
} from '../backend/lib/logistics/provider-callback-application.js';

const result = await applyLogisticsProviderCallback({
  callback: {
    providerId: 'carrier-a',
    callbackId: 'cb-accepted',
    operation: 'delivery',
    resultStatus: 'accepted',
    transactionReference: 'order-123',
  },
  chatId: 'tenant-1',
  serverOrderId: 'order-123',
  actor: { userId: 'user-1' },
  locationId: 'location-1',
  idempotencyKey: 'callback-command-1',
});

assert.equal(result.reliability.apply, true);
assert.equal(result.application_path, 'evidence_only_external_execution_state');
assert.equal(result.canonical_application, 'not_available_without_existing_domain_authority');

const duplicate = await applyLogisticsProviderCallback({
  callback: {
    providerId: 'carrier-a',
    callbackId: 'cb-accepted',
    operation: 'delivery',
    resultStatus: 'accepted',
    transactionReference: 'order-123',
  },
  chatId: 'tenant-1',
  serverOrderId: 'order-123',
  actor: { userId: 'user-1' },
  locationId: 'location-1',
  idempotencyKey: 'callback-command-2',
  processedCallbackIds: ['cb-accepted'],
});
assert.equal(duplicate.reliability.disposition, 'DUPLICATE');
assert.equal(duplicate.canonical_application, 'not_applied');

const contract = logisticsProviderCallbackApplicationContract();
assert.equal(contract.transport, 'deployment_supplied');
assert.equal(contract.authentication, 'deployment_supplied_existing_authorization_boundary');
assert.equal(contract.callback_store, false);
assert.equal(contract.credential_storage, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.payment_mutation, false);
assert.equal(contract.settlement_mutation, false);

console.log('Phase 16.13.19 Logistics provider callback application: PASS');
