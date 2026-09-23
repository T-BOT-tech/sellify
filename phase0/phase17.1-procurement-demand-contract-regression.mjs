import assert from 'node:assert/strict';
import {
  PROCUREMENT_DEMAND_STATES,
  PROCUREMENT_DEMAND_EVENTS,
  PROCUREMENT_DEMAND_CAPABILITY,
  canTransitionProcurementDemand,
  getProcurementDemandTransitions,
  procurementDemandContract,
} from '../app/src/procurement/demand-contract.js';

const contract = procurementDemandContract();
assert.equal(contract.version, '1.0');
assert.deepEqual(contract.states, PROCUREMENT_DEMAND_STATES);
assert.equal(PROCUREMENT_DEMAND_CAPABILITY.capability, 'procurement.demand');
assert.equal(contract.persistence, 'none_in_contract');
assert.equal(contract.inventoryMutation, false);
assert.equal(contract.paymentLedgerMutation, false);
assert.equal(contract.supplierAuthority, false);
assert.equal(contract.b2bQuoteAuthority, false);
assert.equal(contract.b2bPurchaseOrderAuthority, false);
assert.deepEqual(contract.events, PROCUREMENT_DEMAND_EVENTS);
assert.equal(canTransitionProcurementDemand('DRAFT', 'SUBMITTED'), true);
assert.equal(canTransitionProcurementDemand('SUBMITTED', 'SOURCING'), true);
assert.equal(canTransitionProcurementDemand('SOURCING', 'AWARDED'), true);
assert.equal(canTransitionProcurementDemand('DRAFT', 'AWARDED'), false);
assert.equal(canTransitionProcurementDemand('AWARDED', 'DRAFT'), false);
assert.deepEqual(getProcurementDemandTransitions('DRAFT'), ['SUBMITTED', 'CANCELLED']);
assert.deepEqual(getProcurementDemandTransitions('SUBMITTED'), ['SOURCING', 'CANCELLED', 'EXPIRED']);
assert.deepEqual(getProcurementDemandTransitions('SOURCING'), ['AWARDED', 'CANCELLED', 'EXPIRED']);
assert.throws(() => getProcurementDemandTransitions('UNKNOWN'), /Unknown procurement demand state/);
console.log('Phase 17.1 Procurement Demand Contract Regression: PASS');
