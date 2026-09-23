import assert from 'node:assert/strict';
import {
  createSourcingOpportunity,
  phase21SourcingOpportunityContract,
} from '../app/src/phase21-sourcing-opportunity.js';

let pass = 0;
function test(name, fn) { fn(); pass += 1; console.log(`PASS ${name}`); }

const demand = {
  demandReference: { authority: 'procurement', id: 'demand-1' },
  commodityReference: { authority: 'agriculture', id: 'commodity-1' },
};
const supply = {
  supplierReference: { authority: 'supplier_network', id: 'supplier-1' },
  capabilityReference: { authority: 'supplier_network', id: 'capability-1' },
};

function make(status = 'MATCH') {
  return createSourcingOpportunity({
    demand,
    supply,
    match: { status, matchReference: { authority: 'phase21', id: 'match-1' } },
    origin: { locationId: 'origin-1' },
    destination: { locationId: 'destination-1' },
    quantityContext: { quantity: 1000, unit: 'kg' },
    evidenceReferences: [{ id: 'evidence-1', observedAt: '2026-09-15T10:00:00Z' }],
    provenance: { source: 'phase21' },
  });
}

test('contract is derived and non-authoritative', () => {
  const c = phase21SourcingOpportunityContract();
  assert.deepEqual(c.statuses, ['ELIGIBLE', 'CONDITIONAL', 'PARTIAL', 'NOT_ELIGIBLE', 'UNKNOWN']);
  assert.equal(c.persistence, 'none');
  assert.equal(c.ranking, false);
  assert.equal(c.procurementAward, false);
  assert.equal(c.inventoryReservation, false);
  assert.equal(c.orderCreation, false);
});

test('MATCH becomes ELIGIBLE opportunity only', () => {
  assert.equal(make('MATCH').status, 'ELIGIBLE');
  assert.equal(make('MATCH').derived, true);
});

test('conditional and partial matches remain conditional/partial', () => {
  assert.equal(make('CONDITIONAL_MATCH').status, 'CONDITIONAL');
  assert.equal(make('PARTIAL_MATCH').status, 'PARTIAL');
});

test('NO_MATCH does not become an opportunity for acquisition', () => {
  assert.equal(make('NO_MATCH').status, 'NOT_ELIGIBLE');
});

test('UNKNOWN remains UNKNOWN', () => {
  assert.equal(make('UNKNOWN').status, 'UNKNOWN');
});

test('required authorities are preserved', () => {
  const r = make();
  assert.equal(r.demandReference.authority, 'procurement');
  assert.equal(r.commodityReference.authority, 'agriculture');
  assert.equal(r.supplierReference.authority, 'supplier_network');
  assert.equal(r.capabilityReference.authority, 'supplier_network');
});

test('foreign demand authority fails closed', () => {
  assert.throws(() => createSourcingOpportunity({ demand: { ...demand, demandReference: { authority: 'commerce', id: 'demand-1' } }, supply, match: { status: 'MATCH' } }), /authority must be procurement/);
});

test('foreign supplier authority fails closed', () => {
  assert.throws(() => createSourcingOpportunity({ demand, supply: { ...supply, supplierReference: { authority: 'agriculture', id: 'supplier-1' } }, match: { status: 'MATCH' } }), /authority must be supplier_network/);
});

test('foreign commodity authority fails closed', () => {
  assert.throws(() => createSourcingOpportunity({ demand: { ...demand, commodityReference: { authority: 'inventory', id: 'commodity-1' } }, supply, match: { status: 'MATCH' } }), /authority must be agriculture/);
});

test('unsupported match status fails closed', () => {
  assert.throws(() => make('AUTHORIZED'), /unsupported deterministic match status/);
});

test('opportunity is immutable and non-persistent', () => {
  const r = make();
  assert.throws(() => { r.status = 'AUTHORIZED'; }, TypeError);
  assert.equal(r.persistence, 'none');
  assert.equal(r.mutation, false);
});

test('does not reserve inventory or create procurement/order/payment execution', () => {
  const r = make();
  assert.equal(r.inventoryReservation, false);
  assert.equal(r.procurementAward, false);
  assert.equal(r.orderCreation, false);
  assert.equal(r.paymentExecution, false);
  assert.equal(r.providerExecution, false);
});

test('does not rank suppliers or establish trust', () => {
  const r = make();
  assert.equal(r.ranking, false);
  assert.equal(r.supplierAuthority, 'existing supplier-network authority');
});

test('evidence/context are projections, not source authority', () => {
  const r = make();
  assert.equal(r.evidenceReferences.length, 1);
  assert.equal(r.quantityContext.quantity, 1000);
  assert.equal(r.origin.locationId, 'origin-1');
  assert.equal(r.destination.locationId, 'destination-1');
});

test('same inputs yield deterministic opportunity identity', () => {
  const a = make();
  const b = make();
  assert.equal(a.opportunityId, b.opportunityId);
  assert.deepEqual(a.matchReference, b.matchReference);
});

test('explicit opportunity id remains caller-controlled projection identity', () => {
  const r = createSourcingOpportunity({ demand, supply, match: { status: 'MATCH', matchReference: { authority: 'phase21', id: 'match-2' } }, opportunityId: 'opp-99' });
  assert.equal(r.opportunityId, 'opp-99');
});

test('no transaction execution is implied by ELIGIBLE', () => {
  const r = make('MATCH');
  assert.equal(r.status, 'ELIGIBLE');
  assert.equal(r.authorization, false);
  assert.equal(r.orderCreation, false);
  assert.equal(r.paymentExecution, false);
});

console.log(`PHASE21.6 SOURCING OPPORTUNITY: ${pass} PASS / 0 FAIL`);
