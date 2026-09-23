import assert from 'node:assert/strict';
import {
  buildProcurementDemandHandoff,
  buildCommerceHandoff,
  phase21ProcurementCommerceHandoffContract,
} from '../app/src/phase21-procurement-commerce-handoff.js';

let pass = 0;
const test = (name, fn) => {
  try { fn(); pass += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
};

const opportunity = {
  id: 'SO-21-9-1',
  status: 'ELIGIBLE',
  productReference: 'product-1',
  quantity: 100,
};
const demandRequirement = {
  id: 'DR-21-9-1',
  commodityReference: 'commodity-1',
  quantity: 100,
  unit: 'kg',
};

test('procurement handoff delegates to existing procurement authority', () => {
  const result = buildProcurementDemandHandoff({ opportunity, demandRequirement });
  assert.equal(result.target_authority, 'procurement');
  assert.equal(result.execution, 'DELEGATE_TO_EXISTING_PROCUREMENT_AUTHORITY');
  assert.equal(result.creates_procurement_demand, false);
});

test('procurement handoff preserves demand and commodity references', () => {
  const result = buildProcurementDemandHandoff({ opportunity, demandRequirement });
  assert.equal(result.demand_reference, 'DR-21-9-1');
  assert.equal(result.commodity_reference, 'commodity-1');
  assert.equal(result.quantity, 100);
  assert.equal(result.unit, 'kg');
});

test('procurement handoff cannot create RFQ or award', () => {
  const result = buildProcurementDemandHandoff({ opportunity, demandRequirement });
  assert.equal(result.creates_rfq, false);
  assert.equal(result.creates_award, false);
  assert.equal(result.creates_purchase_order, false);
});

test('commerce handoff delegates to existing commerce authority', () => {
  const result = buildCommerceHandoff({ opportunity });
  assert.equal(result.target_authority, 'commerce');
  assert.equal(result.execution, 'DELEGATE_TO_EXISTING_COMMERCE_AUTHORITY');
  assert.equal(result.creates_order, false);
});

test('conditional sourcing cannot directly hand off to Commerce', () => {
  assert.throws(() => buildCommerceHandoff({ opportunity: { ...opportunity, status: 'CONDITIONAL' } }), /eligible sourcing opportunity/);
});

test('unknown sourcing opportunity is rejected', () => {
  assert.throws(() => buildProcurementDemandHandoff({ opportunity: { ...opportunity, status: 'UNKNOWN' }, demandRequirement }), /eligible or conditional/);
});

test('procurement demand handoff has no inventory mutation', () => {
  const result = buildProcurementDemandHandoff({ opportunity, demandRequirement });
  assert.equal(result.mutates_inventory, false);
  assert.equal(result.mutates_payment, false);
  assert.equal(result.mutates_commerce_order, false);
});

test('commerce handoff has no procurement mutation', () => {
  const result = buildCommerceHandoff({ opportunity });
  assert.equal(result.creates_procurement_award, false);
  assert.equal(result.mutates_inventory, false);
  assert.equal(result.mutates_payment, false);
});

test('contract declares delegation-only execution', () => {
  const contract = phase21ProcurementCommerceHandoffContract();
  assert.equal(contract.execution, 'delegation_only');
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.authorization, 'existing_target_authority');
});

test('contract preserves canonical procurement authority', () => {
  const contract = phase21ProcurementCommerceHandoffContract();
  assert.equal(contract.procurementAuthority, 'existing_procurement');
  assert.equal(contract.procurementDemandCreation, 'existing_procurement_authority_only');
  assert.equal(contract.rfqCreation, 'existing_procurement_authority_only');
  assert.equal(contract.awardCreation, 'existing_procurement_authority_only');
});

test('contract preserves canonical B2B PO authority', () => {
  const contract = phase21ProcurementCommerceHandoffContract();
  assert.equal(contract.purchaseOrderCreation, 'existing_b2b_purchase_order_authority_only');
});

test('contract preserves canonical Commerce authority', () => {
  const contract = phase21ProcurementCommerceHandoffContract();
  assert.equal(contract.commerceOrderCreation, 'existing_commerce_order_authority_only');
});

test('contract preserves inventory and payment authorities', () => {
  const contract = phase21ProcurementCommerceHandoffContract();
  assert.equal(contract.inventoryAuthority, 'existing_inventory');
  assert.equal(contract.paymentAuthority, 'existing_payment_core');
});

test('missing demand reference fails closed', () => {
  assert.throws(() => buildProcurementDemandHandoff({ opportunity, demandRequirement: { ...demandRequirement, id: '' } }), /Demand Requirement reference/);
});

test('invalid quantity fails closed', () => {
  assert.throws(() => buildCommerceHandoff({ opportunity: { ...opportunity, quantity: 0 } }), /positive integer/);
});

test('missing product reference fails closed', () => {
  assert.throws(() => buildCommerceHandoff({ opportunity: { ...opportunity, productReference: '' } }), /Product reference/);
});

test('no provider execution is declared', () => {
  assert.equal(phase21ProcurementCommerceHandoffContract().providerExecution, false);
});

test('AI is not an executor', () => {
  assert.equal(phase21ProcurementCommerceHandoffContract().aiExecution, false);
});

test('sourcing remains the source authority for the handoff', () => {
  const procurement = buildProcurementDemandHandoff({ opportunity, demandRequirement });
  const commerce = buildCommerceHandoff({ opportunity });
  assert.equal(procurement.source_authority, 'phase21_sourcing');
  assert.equal(commerce.source_authority, 'phase21_sourcing');
});

console.log(`PHASE 21.9 PROCUREMENT / COMMERCE HANDOFF: ${pass} PASS / 0 FAIL`);
