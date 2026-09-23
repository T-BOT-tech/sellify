import assert from 'node:assert/strict';
import { buildNetworkIntelligenceControlProjection, phase21NetworkIntelligenceControlContract } from '../app/src/phase21-network-intelligence-control.js';

const opportunity = {
  opportunityId:'opp-1', derived:true, persistence:'none', mutation:false,
  status:'ELIGIBLE', commodityReference:{authority:'agriculture',entity:'Commodity',id:'c-1'},
  supplierReference:{authority:'supplier_network',entity:'Supplier',id:'s-1'}
};
const projection = buildNetworkIntelligenceControlProjection({
  projectionId:'network-1', sourcingOpportunities:[{...opportunity, gapState:'COVERED'}],
  supplyGaps:[{id:'gap-1',state:'PARTIAL_GAP'}],
  discoveryProjections:[{rank:1}], crossBorderProjections:[{evaluation:'FEASIBLE'}],
  performanceEvidence:[{metric:'FILL_RATE'}], trustEvidence:[{type:'PERFORMANCE_OBSERVED'}],
  provenance:{source:'phase21'}
});
assert.equal(projection.derived,true);
assert.equal(projection.persistence,'none');
assert.equal(projection.mutation,false);
assert.equal(projection.summary.opportunityCount,1);
assert.equal(projection.summary.supplierCount,1);
assert.equal(projection.summary.gapStateCounts.COVERED,1);
assert.equal(projection.controls.supplierSelection,false);
assert.equal(projection.controls.ranking,false);
assert.equal(projection.controls.trustScoring,false);
assert.equal(projection.controls.inventoryMutation,false);
assert.equal(projection.controls.procurementMutation,false);
assert.equal(projection.controls.execution,false);
assert.equal(projection.authorities.discovery,'phase19.discovery_fabric');
assert.equal(projection.authorities.crossBorder,'phase20.cross_border_coordination');
assert.equal(projection.authorities.inventory,'existing inventory authority');
assert.equal(projection.authorities.procurement,'existing procurement authority');
assert.throws(() => buildNetworkIntelligenceControlProjection({ sourcingOpportunities:[{...opportunity, supplierReference:{authority:'phase21',id:'bad'}}] }), /supplier-network authority/);
const contract=phase21NetworkIntelligenceControlContract();
assert.equal(contract.persistence,'none');
assert.equal(contract.mutation,false);
assert.equal(contract.createsRankingAuthority,false);
assert.equal(contract.createsTrustScore,false);
assert.equal(contract.createsInventoryAuthority,false);
assert.equal(contract.createsProcurementAuthority,false);
assert.equal(contract.createsTransactionAuthority,false);
assert.equal(contract.executesProviders,false);
console.log('PHASE 21.12 NETWORK INTELLIGENCE / CONTROL: 15 PASS / 0 FAIL');
