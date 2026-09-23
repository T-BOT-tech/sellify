import assert from 'node:assert/strict';
import { defineLogisticsProviderExecutionHandoff, logisticsProviderExecutionHandoffContract } from '../app/src/verticals/logistics/provider-execution-handoff-contract.js';

const base = {
  operation: 'delivery',
  selected_provider_id: 'provider-a',
  adapter_id: 'logistics-provider-a',
  provider_type: 'courier',
  authorization: { authorized: true, reference: 'auth-001' },
  transaction: { reference: 'txn-001', authority: 'existing_domain_transaction' },
};

const h = defineLogisticsProviderExecutionHandoff(base);
assert.equal(h.contract_version, '1.0');
assert.equal(h.selected_provider_id, 'provider-a');
assert.equal(h.adapter_id, 'logistics-provider-a');
assert.equal(h.authorization.authorized, true);
assert.equal(h.transaction.authority, 'existing_domain_transaction');
assert.equal(h.execution, 'handoff_only');
assert.equal(h.external_execution, false);
assert.equal(h.domain_mutation, false);
assert.equal(h.persistence, 'none');
assert.equal(h.credential_storage, false);
assert.equal(h.provider_selection, 'already_selected');
assert.equal(h.canonical_authority, 'logistics');
assert.equal(h.fulfillment_authority, 'app/src/logistics/fulfillment.js');

assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, authorization: { authorized: false, reference: 'auth-001' } }), /explicit authorization/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, authorization: undefined }), /authorization evidence is required/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, transaction: { reference: 'txn-001', authority: 'new_execution_engine' } }), /existing_domain_transaction/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, credentials: { token: 'secret' } }), /credentials/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, execute: true }), /execute/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, shipment: { id: 's1' } }), /shipment/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, operation: 'unknown' }), /unsupported operation/);
assert.throws(() => defineLogisticsProviderExecutionHandoff({ ...base, selected_provider_id: 'provider-b', adapter_id: 'logistics-provider-a', adapter_provider: 'provider-a' }), /adapter provider must match/);

const contract = logisticsProviderExecutionHandoffContract();
assert.equal(contract.authorization, 'existing_authorization');
assert.equal(contract.transactionAuthority, 'existing_domain_transaction');
assert.equal(contract.external_execution, false);
assert.equal(contract.domain_mutation, false);
assert.equal(contract.persistence, 'none');
assert.equal(contract.credential_storage, false);

console.log('Phase 16.13.7 logistics provider execution handoff: PASS (18/18)');
