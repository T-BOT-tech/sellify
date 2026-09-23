import assert from 'node:assert/strict';
import {
  projectDemandRequirement,
  phase21DemandRequirementContract,
} from '../app/src/phase21-demand-requirement.js';

let pass = 0;
function test(name, fn) { fn(); pass += 1; console.log(`PASS ${name}`); }

const base = {
  demandId: 'demand-1',
  commodity: { id: 'commodity-1', authority: 'agriculture' },
  quantity: 1000,
  unit: 'kg',
  specification: { grade: 'A', packaging: '25kg-bag' },
  destination: { id: 'loc-1', authority: 'locations' },
  requiredDate: '2026-10-01T00:00:00Z',
  qualificationRequirements: [{ code: 'quality-certified' }],
  logisticsRequirements: { deliveryMode: 'road' },
  commercialRequirements: { currency: 'ETB', paymentTerms: '30D' },
  status: 'ACTIVE',
  provenance: { sourceId: 'proc-1', method: 'canonical-procurement-demand' },
};

test('contract reuses Procurement demand authority', () => {
  const c = phase21DemandRequirementContract();
  assert.equal(c.authority, 'procurement');
  assert.equal(c.sourceAuthority, 'procurement.demand');
  assert.equal(c.persistence, 'none');
  assert.equal(c.mutation, false);
});

test('projects procurement demand by reference', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.demandReference, {
    authority: 'procurement', resource: 'procurement_demand', id: 'demand-1',
  });
});

test('preserves commodity as Agriculture authority', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.commodityReference, {
    authority: 'agriculture', entity: 'Commodity', id: 'commodity-1',
  });
});

test('preserves quantity and unit for matching', () => {
  const r = projectDemandRequirement(base);
  assert.equal(r.quantity, 1000);
  assert.equal(r.unit, 'kg');
});

test('preserves specification without owning a product catalog', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.specification, base.specification);
  assert.equal(r.commerceAuthority, 'existing commerce authority');
});

test('uses existing location authority', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.destination, { authority: 'locations', entity: 'Location', id: 'loc-1' });
});

test('normalizes required date', () => {
  const r = projectDemandRequirement({ ...base, requiredDate: '2026-10-01T00:00:00+00:00' });
  assert.equal(r.requiredDate, '2026-10-01T00:00:00.000Z');
});

test('preserves qualification requirements', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.qualificationRequirements, [{ code: 'quality-certified' }]);
});

test('preserves logistics and commercial requirements', () => {
  const r = projectDemandRequirement(base);
  assert.deepEqual(r.logisticsRequirements, { deliveryMode: 'road' });
  assert.deepEqual(r.commercialRequirements, { currency: 'ETB', paymentTerms: '30D' });
});

test('unknown status does not become active', () => {
  const r = projectDemandRequirement({ ...base, status: undefined });
  assert.equal(r.status, 'UNKNOWN');
});

test('foreign demand authority fails closed', () => {
  assert.throws(
    () => projectDemandRequirement({ ...base, demandId: undefined, id: 'd-1', demandAuthority: 'inventory' }),
    /demandAuthority must be procurement/,
  );
});

test('foreign commodity authority fails closed', () => {
  assert.throws(
    () => projectDemandRequirement({ ...base, commodity: { id: 'c-1', authority: 'inventory' } }),
    /commodity.authority must be agriculture/,
  );
});

test('foreign destination authority fails closed', () => {
  assert.throws(
    () => projectDemandRequirement({ ...base, destination: { id: 'loc-1', authority: 'inventory' } }),
    /destination.authority must be locations/,
  );
});

test('invalid quantity fails closed', () => {
  assert.throws(() => projectDemandRequirement({ ...base, quantity: 0 }), /quantity must be a positive number/);
});

test('invalid required date fails closed', () => {
  assert.throws(() => projectDemandRequirement({ ...base, requiredDate: 'not-a-date' }), /requiredDate must be a valid ISO-8601/);
});

test('projection is immutable', () => {
  const r = projectDemandRequirement(base);
  assert.throws(() => { r.quantity = 9; }, TypeError);
  assert.throws(() => { r.demandReference.id = 'changed'; }, TypeError);
  assert.throws(() => { r.qualificationRequirements.push({}); }, TypeError);
});

test('does not create execution or persistence authority', () => {
  const r = projectDemandRequirement(base);
  assert.equal(r.persistence, 'none');
  assert.equal(r.mutation, false);
  assert.equal(r.authorization, false);
  assert.equal(r.transactionExecution, false);
  assert.equal(r.providerExecution, false);
  assert.equal(r.inventoryAuthority, 'existing inventory authority');
});

test('provenance is copied rather than owned', () => {
  const provenance = { sourceId: 'proc-2' };
  const r = projectDemandRequirement({ ...base, provenance });
  assert.deepEqual(r.provenance, provenance);
  assert.notEqual(r.provenance, provenance);
});

console.log(`PHASE21.4 DEMAND REQUIREMENT: ${pass} PASS / 0 FAIL`);
