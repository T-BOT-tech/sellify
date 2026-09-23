import assert from 'node:assert/strict';
import {
  projectCapacityAvailabilityEvidence,
  phase21CapacityAvailabilityEvidenceContract,
} from '../app/src/phase21-capacity-availability-evidence.js';

let pass = 0;
function test(name, fn) { fn(); pass += 1; console.log(`PASS ${name}`); }

const base = {
  id: 'cap-signal-1',
  authority: 'supplier_network',
  subjectType: 'CAPABILITY',
  subjectId: 'cap-1',
  organizationId: 'org-1',
  quantity: 500,
  unit: 'bags',
  observedAt: '2026-09-15T10:00:00Z',
  validUntil: '2026-09-20T10:00:00Z',
  quality: 'VERIFIED',
  source: 'supplier-network',
  provenance: { sourceId: 'obs-1', method: 'verified' },
};

test('contract reuses Supplier Network capacity authority', () => {
  const c = phase21CapacityAvailabilityEvidenceContract();
  assert.equal(c.authority, 'supplier_network');
  assert.equal(c.sourceAuthority, 'supplier-network.capacity');
  assert.equal(c.persistence, 'none');
  assert.equal(c.mutation, false);
});

test('projects canonical capacity by reference', () => {
  const r = projectCapacityAvailabilityEvidence(base);
  assert.deepEqual(r.capacityReference, {
    authority: 'supplier_network', resource: 'supplier_network_capacity_signal', id: 'cap-signal-1',
  });
  assert.deepEqual(r.subjectReference, { authority: 'supplier_network', entity: 'CAPABILITY', id: 'cap-1' });
  assert.deepEqual(r.supplierReference, { authority: 'organizations', entity: 'Organization', id: 'org-1' });
});

test('keeps capacity separate from inventory', () => {
  const r = projectCapacityAvailabilityEvidence(base);
  assert.equal(r.inventoryAuthority, 'existing inventory authority');
  assert.equal(r.persistence, 'none');
});

test('preserves quantity and unit as an observation', () => {
  const r = projectCapacityAvailabilityEvidence(base);
  assert.equal(r.quantity, 500);
  assert.equal(r.unit, 'bags');
});

test('normalizes observation window to ISO timestamps', () => {
  const r = projectCapacityAvailabilityEvidence({ ...base, observedAt: '2026-09-15T10:00:00+00:00' });
  assert.equal(r.availabilityWindow.observedAt, '2026-09-15T10:00:00.000Z');
  assert.equal(r.availabilityWindow.validUntil, '2026-09-20T10:00:00.000Z');
});

test('supports explicit evidence quality states', () => {
  for (const quality of ['SELF_REPORTED', 'OBSERVED', 'VERIFIED', 'STALE', 'UNKNOWN', 'CONFLICTING']) {
    assert.equal(projectCapacityAvailabilityEvidence({ ...base, quality }).quality, quality);
  }
});

test('unknown quality does not become success', () => {
  assert.equal(projectCapacityAvailabilityEvidence({ ...base, quality: undefined }).quality, 'UNKNOWN');
});

test('foreign authority fails closed', () => {
  assert.throws(() => projectCapacityAvailabilityEvidence({ ...base, authority: 'inventory' }), /authority must be supplier_network/);
});

test('invalid subject type fails closed', () => {
  assert.throws(() => projectCapacityAvailabilityEvidence({ ...base, subjectType: 'INVENTORY' }), /subjectType must be PRODUCT or CAPABILITY/);
});

test('missing quantity fails closed', () => {
  assert.throws(() => projectCapacityAvailabilityEvidence({ ...base, quantity: 0 }), /quantity must be a positive number/);
});

test('invalid time window fails closed', () => {
  assert.throws(() => projectCapacityAvailabilityEvidence({ ...base, validUntil: '2026-09-10T00:00:00Z' }), /validUntil must not be earlier/);
});

test('missing observation timestamp fails closed', () => {
  const { observedAt, ...rest } = base;
  assert.throws(() => projectCapacityAvailabilityEvidence(rest), /observedAt must be a non-empty string/);
});

test('projection is immutable', () => {
  const r = projectCapacityAvailabilityEvidence(base);
  assert.throws(() => { r.quantity = 99; }, TypeError);
  assert.throws(() => { r.availabilityWindow.validUntil = null; }, TypeError);
  assert.throws(() => { r.capacityReference.id = 'changed'; }, TypeError);
});

test('provenance is copied rather than owned', () => {
  const provenance = { sourceId: 'obs-2' };
  const r = projectCapacityAvailabilityEvidence({ ...base, provenance });
  assert.deepEqual(r.provenance, provenance);
  assert.notEqual(r.provenance, provenance);
});

test('execution remains disabled', () => {
  const r = projectCapacityAvailabilityEvidence(base);
  assert.equal(r.transactionExecution, false);
  assert.equal(r.providerExecution, false);
});

console.log(`PHASE21.3 CAPACITY / AVAILABILITY EVIDENCE: ${pass} PASS / 0 FAIL`);
