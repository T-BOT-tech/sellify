import assert from 'node:assert/strict';
import {
  logisticsProviderCanonicalApplicationContract,
  resolveLogisticsProviderCanonicalApplicationPath,
} from '../backend/lib/logistics/provider-execution-application.js';

const contract = logisticsProviderCanonicalApplicationContract();

assert.deepEqual(contract.supported_provider_result, ['fulfillment_delivered']);
assert.equal(contract.fulfillment_authority, 'backend/lib/store-sqlite.js');
assert.equal(contract.inventory_authority, 'existing_core_fulfillment_inventory_consequence');
assert.equal(contract.audit_authority, 'existing_audit_authority');
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.payment_mutation, false);
assert.equal(contract.settlement_mutation, false);
assert.equal(contract.flow, 'provider_result -> existing_domain_transaction -> canonical_fulfillment -> inventory_consequence -> audit');
const expectedPaths = {
  fulfillment_delivered: 'existing_core_fulfillment_transition',
  execution_accepted: 'evidence_only_external_execution_state',
  execution_in_progress: 'evidence_only_external_execution_state',
  tracking_update: 'requires_existing_tracking_mutation_authority',
  proof_captured: 'requires_existing_proof_mutation_authority',
  execution_failed: 'requires_existing_delivery_exception_authority',
  return_completed: 'requires_existing_return_authority',
};
for (const [result, path] of Object.entries(expectedPaths)) {
  assert.equal(resolveLogisticsProviderCanonicalApplicationPath(result), path);
}
assert.equal(resolveLogisticsProviderCanonicalApplicationPath('unknown_result'), 'unsupported_provider_result');
assert.deepEqual(contract.provider_result_application_paths, expectedPaths);

console.log('Phase 16.13.13 Logistics provider canonical application boundary: PASS');
