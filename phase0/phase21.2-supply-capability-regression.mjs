import assert from 'node:assert/strict';
import {
  projectSupplyCapability,
  phase21SupplyCapabilityContract,
} from '../app/src/phase21-supply-capability.js';

let pass = 0;
function test(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

test('contract reuses Supplier Network capability authority', () => {
  const c = phase21SupplyCapabilityContract();
  assert.equal(c.authority, 'supplier_network');
  assert.equal(c.sourceAuthority, 'supplier-network.capability');
  assert.equal(c.persistence, 'none');
  assert.equal(c.mutation, false);
});

test('projects existing capability by reference', () => {
  const result = projectSupplyCapability({
    id: 'cap-1',
    authority: 'supplier_network',
    organizationId: 'org-1',
    code: 'wholesale',
    name: 'Wholesale Supply',
    category: 'distribution',
    status: 'ACTIVE',
    source: 'DECLARED',
  });
  assert.deepEqual(result.capabilityReference, {
    authority: 'supplier_network',
    resource: 'supplier_network_capability',
    id: 'cap-1',
  });
  assert.deepEqual(result.supplierReference, {
    authority: 'organizations',
    entity: 'Organization',
    id: 'org-1',
  });
});

test('preserves canonical capability status and source', () => {
  const result = projectSupplyCapability({
    id: 'cap-2', organizationId: 'org-2', status: 'INACTIVE', source: 'VERIFIED',
  });
  assert.equal(result.status, 'INACTIVE');
  assert.equal(result.source, 'VERIFIED');
});

test('does not invent inventory or procurement authority', () => {
  const result = projectSupplyCapability({
    id: 'cap-3', organizationId: 'org-3', status: 'ACTIVE', source: 'DECLARED',
  });
  assert.equal(result.inventoryAuthority, undefined);
  assert.equal(result.procurementAuthority, undefined);
  assert.equal(result.persistence, 'none');
});

test('foreign capability authority fails closed', () => {
  assert.throws(
    () => projectSupplyCapability({ id: 'cap-4', authority: 'other_system', organizationId: 'org-4' }),
    /authority must be supplier_network/,
  );
});

test('missing capability id fails closed', () => {
  assert.throws(
    () => projectSupplyCapability({ organizationId: 'org-5' }),
    /capability.id must be a non-empty string/,
  );
});

test('missing supplier organization fails closed', () => {
  assert.throws(
    () => projectSupplyCapability({ id: 'cap-6' }),
    /capability.supplierOrganizationId must be a non-empty string/,
  );
});

test('invalid status is rejected', () => {
  assert.throws(
    () => projectSupplyCapability({ id: 'cap-7', organizationId: 'org-7', status: 'BOGUS' }),
    /capability.status must be one of/,
  );
});

test('invalid source is rejected', () => {
  assert.throws(
    () => projectSupplyCapability({ id: 'cap-8', organizationId: 'org-8', source: 'INVENTED' }),
    /capability.source must be one of/,
  );
});

test('projection is immutable', () => {
  const result = projectSupplyCapability({ id: 'cap-9', organizationId: 'org-9' });
  assert.throws(() => { result.status = 'ACTIVE'; }, TypeError);
  assert.throws(() => { result.capabilityReference.id = 'changed'; }, TypeError);
});

test('metadata is copied as non-authoritative projection', () => {
  const metadata = { minimumOrderQuantity: 100, unit: 'bags' };
  const result = projectSupplyCapability({ id: 'cap-10', organizationId: 'org-10', metadata });
  assert.deepEqual(result.metadata, metadata);
  assert.notEqual(result.metadata, metadata);
});

test('unknown status/source remain explicit rather than becoming success', () => {
  const result = projectSupplyCapability({ id: 'cap-11', organizationId: 'org-11' });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.source, 'UNKNOWN');
});

test('provider execution remains disabled', () => {
  const result = projectSupplyCapability({ id: 'cap-12', organizationId: 'org-12' });
  assert.equal(result.providerExecution, false);
  assert.equal(result.transactionExecution, false);
});

console.log(`PHASE21.2 SUPPLY CAPABILITY: ${pass} PASS / 0 FAIL`);
