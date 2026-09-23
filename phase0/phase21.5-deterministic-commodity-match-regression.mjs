import assert from 'node:assert/strict';
import {
  evaluateCommodityMatch,
  phase21DeterministicCommodityMatchContract,
} from '../app/src/phase21-deterministic-commodity-match.js';

let pass = 0;
function test(name, fn) { fn(); pass += 1; console.log(`PASS ${name}`); }

const baseDemand = {
  commodityReference: { authority: 'agriculture', entity: 'Commodity', id: 'commodity-1' },
  quantity: 1000,
  unit: 'kg',
  specification: { grade: 'A', packaging: '25kg-bag' },
};
const baseSupply = {
  commodityReference: { authority: 'agriculture', entity: 'Commodity', id: 'commodity-1' },
  quantity: 1500,
  unit: 'kg',
  specification: { grade: 'A', packaging: '25kg-bag' },
  status: 'ACTIVE',
  capacityEvidence: { quality: 'VERIFIED' },
};

test('contract preserves existing authorities', () => {
  const c = phase21DeterministicCommodityMatchContract();
  assert.equal(c.commodityAuthority, 'agriculture');
  assert.equal(c.capabilityAuthority, 'supplier_network');
  assert.equal(c.capacityAuthority, 'supplier_network');
  assert.equal(c.demandAuthority, 'procurement');
  assert.equal(c.persistence, 'none');
  assert.equal(c.ranking, false);
});

test('exact commodity, specification, unit and quantity produce MATCH', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: baseSupply });
  assert.equal(r.status, 'MATCH');
  assert.equal(r.deterministic, true);
  assert.equal(r.ai, false);
});

test('commodity mismatch is NO_MATCH regardless of other signals', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, commodityReference: { authority: 'agriculture', entity: 'Commodity', id: 'commodity-2' } } });
  assert.equal(r.status, 'NO_MATCH');
  assert.ok(r.reasons.includes('commodity_mismatch'));
});

test('specification mismatch is PARTIAL_MATCH, not success', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, specification: { grade: 'B', packaging: '25kg-bag' } } });
  assert.equal(r.status, 'PARTIAL_MATCH');
});

test('insufficient quantity is CONDITIONAL_MATCH', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, quantity: 500 } });
  assert.equal(r.status, 'CONDITIONAL_MATCH');
});

test('unit mismatch is CONDITIONAL_MATCH', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, quantity: 2000, unit: 'bags' } });
  assert.equal(r.status, 'CONDITIONAL_MATCH');
});

test('inactive capability is conditional, not executable', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, status: 'INACTIVE' } });
  assert.equal(r.status, 'CONDITIONAL_MATCH');
  assert.equal(r.transactionExecution, false);
});

test('unknown evidence remains UNKNOWN', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, capacityEvidence: { quality: 'UNKNOWN' } } });
  assert.equal(r.status, 'UNKNOWN');
});

test('missing quantity remains UNKNOWN rather than success', () => {
  const r = evaluateCommodityMatch({ demand: { ...baseDemand, quantity: undefined }, supply: baseSupply });
  assert.equal(r.status, 'UNKNOWN');
});

test('foreign demand commodity authority fails closed', () => {
  assert.throws(() => evaluateCommodityMatch({ demand: { ...baseDemand, commodityReference: { authority: 'inventory', id: 'commodity-1' } }, supply: baseSupply }), /authority must be agriculture/);
});

test('foreign supply commodity authority fails closed', () => {
  assert.throws(() => evaluateCommodityMatch({ demand: baseDemand, supply: { ...baseSupply, commodityReference: { authority: 'inventory', id: 'commodity-1' } } }), /authority must be agriculture/);
});

test('matching is immutable and non-persistent', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: baseSupply });
  assert.throws(() => { r.status = 'NO_MATCH'; }, TypeError);
  assert.equal(r.persistence, 'none');
  assert.equal(r.mutation, false);
});

test('does not create inventory, procurement, payment or provider execution authority', () => {
  const r = evaluateCommodityMatch({ demand: baseDemand, supply: baseSupply });
  assert.equal(r.inventoryAuthority, 'existing inventory authority');
  assert.equal(r.procurementAuthority, 'existing procurement authority');
  assert.equal(r.transactionExecution, false);
  assert.equal(r.providerExecution, false);
});

console.log(`PHASE21.5 DETERMINISTIC COMMODITY MATCH: ${pass} PASS / 0 FAIL`);
