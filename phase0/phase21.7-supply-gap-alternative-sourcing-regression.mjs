import assert from 'node:assert/strict';
import { deriveSupplyGap, phase21SupplyGapContract } from '../app/src/phase21-supply-gap-alternative-sourcing.js';

const demand = {
  demandReference: { id: 'd1', authority: 'procurement' },
  commodityReference: { id: 'coffee', authority: 'agriculture' },
  quantity: 100,
  unit: 'kg',
};
const opp = (id, supplier, quantity, status = 'ELIGIBLE', origin = 'ET') => ({
  opportunityId: id,
  status,
  commodityReference: { id: 'coffee', authority: 'agriculture' },
  supplierReference: { id: supplier, authority: 'supplier_network' },
  capabilityReference: { id: `cap-${supplier}`, authority: 'supplier_network' },
  quantityContext: { quantity, unit: 'kg' },
  origin: { country: origin },
});

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('contract is derived and non-persistent', () => {
  const c = phase21SupplyGapContract();
  assert.equal(c.persistence, 'none'); assert.equal(c.inventoryFact, false); assert.equal(c.procurementAward, false);
});
test('full gap when no known matching opportunity exists', () => assert.equal(deriveSupplyGap({ demand }).status, 'FULL_GAP'));
test('covered when confirmed eligible quantity meets demand', () => assert.equal(deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 100)] }).status, 'COVERED'));
test('partial gap when confirmed quantity is insufficient', () => {
  const r = deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 60)] });
  assert.equal(r.status, 'PARTIAL_GAP'); assert.equal(r.remainingQuantity, 40);
});
test('unknown never becomes confirmed supply', () => {
  const r = deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 100, 'UNKNOWN')] });
  assert.equal(r.status, 'UNKNOWN'); assert.equal(r.confirmedQuantity, 0);
});
test('alternative sourcing excludes the selected primary opportunity', () => {
  const r = deriveSupplyGap({ demand, primaryOpportunityId: 'o1', opportunities: [opp('o1', 's1', 50), opp('o2', 's2', 50)] });
  assert.deepEqual(r.alternativeSourcing.map(x => x.opportunityId), ['o2']);
});
test('commodity mismatch is not counted', () => {
  const other = { ...opp('o1', 's1', 100), commodityReference: { id: 'maize', authority: 'agriculture' } };
  assert.equal(deriveSupplyGap({ demand, opportunities: [other] }).status, 'FULL_GAP');
});
test('unit mismatch is not confirmed', () => {
  const other = { ...opp('o1', 's1', 100), quantityContext: { quantity: 100, unit: 'ton' } };
  assert.equal(deriveSupplyGap({ demand, opportunities: [other] }).status, 'UNKNOWN');
});
test('does not expose an execution authority', () => {
  const r = deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 100)] });
  assert.equal(r.orderCreation, false); assert.equal(r.paymentExecution, false); assert.equal(r.providerExecution, false);
});
test('result is immutable', () => {
  const r = deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 100)] });
  assert.equal(Object.isFrozen(r), true); assert.equal(Object.isFrozen(r.alternativeSourcing), true);
});

test('invalid opportunity collection is rejected', () => assert.throws(() => deriveSupplyGap({ demand, opportunities: {} }), /opportunities must be an array/));

test('invalid demand quantity is rejected', () => assert.throws(() => deriveSupplyGap({ demand: { ...demand, quantity: 0 } }), /positive number/));

test('procurement remains demand authority', () => assert.equal(deriveSupplyGap({ demand }).demandReference.authority, 'procurement'));
test('inventory remains separate authority', () => assert.equal(phase21SupplyGapContract().inventoryAuthority, 'existing inventory authority'));
test('supplier network remains capacity authority', () => assert.equal(phase21SupplyGapContract().capacityAuthority, 'existing supplier-network authority'));

test('gap never mutates input', () => {
  const input = [opp('o1', 's1', 50)];
  const before = JSON.stringify(input);
  deriveSupplyGap({ demand, opportunities: input });
  assert.equal(JSON.stringify(input), before);
});

test('derived gap can coexist with alternative origins', () => {
  const r = deriveSupplyGap({ demand, opportunities: [opp('o1', 's1', 50, 'ELIGIBLE', 'ET'), opp('o2', 's2', 40, 'ELIGIBLE', 'KE')] });
  assert.equal(r.status, 'PARTIAL_GAP'); assert.equal(r.alternativeSourcing.length, 2);
});

console.log(`PHASE 21.7 SUPPLY GAP / ALTERNATIVE SOURCING: ${passed} PASS / 0 FAIL`);
