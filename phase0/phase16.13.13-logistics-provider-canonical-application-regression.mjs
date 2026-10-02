import assert from 'node:assert/strict';
import {
  logisticsProviderCanonicalApplicationContract,
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

console.log('Phase 16.13.13 Logistics provider canonical application boundary: PASS');
