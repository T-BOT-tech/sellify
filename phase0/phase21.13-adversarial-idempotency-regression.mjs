import assert from 'node:assert/strict';
import { evaluateCommodityMatch } from '../app/src/phase21-deterministic-commodity-match.js';
import { createSourcingOpportunity } from '../app/src/phase21-sourcing-opportunity.js';
import { deriveSupplyGap } from '../app/src/phase21-supply-gap-alternative-sourcing.js';
import { projectSourcingOpportunityToCrossBorder } from '../app/src/phase21-cross-border-integration.js';
import { assertSafeReplay, assertNoExecutionAuthority, phase21AdversarialContract } from '../app/src/phase21-adversarial-idempotency-regression.js';

const demand = { demandReference:{authority:'procurement',id:'d-1'}, commodityReference:{authority:'agriculture',id:'coffee'}, quantity:100, unit:'kg', specification:{grade:'A'} };
const supply = { supplierReference:{authority:'supplier_network',id:'s-1'}, capabilityReference:{authority:'supplier_network',id:'cap-1'}, commodityReference:{authority:'agriculture',id:'coffee'}, quantity:120, unit:'kg', specification:{grade:'A'}, status:'ACTIVE', capacityEvidence:{quality:'VERIFIED'} };

const match1 = evaluateCommodityMatch({demand,supply});
const match2 = evaluateCommodityMatch({demand,supply});
assert.equal(match1.status,'MATCH');
assertSafeReplay(match1, match2);
assertNoExecutionAuthority(match1,'commodity match');

const opportunity = createSourcingOpportunity({demand,supply,match:match1,opportunityId:'opp-1',origin:{countryCode:'ET'},destination:{countryCode:'DJ'},quantityContext:{quantity:120,unit:'kg'}});
assert.equal(opportunity.status,'ELIGIBLE');
assertNoExecutionAuthority(opportunity,'sourcing opportunity');
assertSafeReplay(opportunity, createSourcingOpportunity({demand,supply,match:match2,opportunityId:'opp-1',origin:{countryCode:'ET'},destination:{countryCode:'DJ'},quantityContext:{quantity:120,unit:'kg'}}));

const gap = deriveSupplyGap({demand,opportunities:[opportunity]});
assert.equal(gap.status,'COVERED');
assert.equal(gap.inventoryFact,false);
assert.equal(gap.procurementAward,false);

const unknownSupply = {...supply, capacityEvidence:{quality:'UNKNOWN'}, quantity:120};
const unknownMatch = evaluateCommodityMatch({demand,supply:unknownSupply});
assert.equal(unknownMatch.status,'UNKNOWN');
const unknownOpp = createSourcingOpportunity({demand,supply:unknownSupply,match:unknownMatch,opportunityId:'opp-unknown'});
assert.equal(unknownOpp.status,'UNKNOWN');
const unknownGap = deriveSupplyGap({demand,opportunities:[unknownOpp]});
assert.equal(unknownGap.status,'UNKNOWN');
assert.notEqual(unknownGap.status,'COVERED');

const conflict = evaluateCommodityMatch({demand,supply:{...supply,commodityReference:{authority:'agriculture',id:'sesame'}}});
assert.equal(conflict.status,'NO_MATCH');
assertNoExecutionAuthority(conflict,'conflicting commodity match');

const crossBorder = projectSourcingOpportunityToCrossBorder({sourcingOpportunity:opportunity,origin:'ET',destination:'DJ'});
assert.equal(crossBorder.execution,false);
assert.equal(crossBorder.mutatesInventory,false);
assert.equal(crossBorder.createsOrder,false);
assertNoExecutionAuthority(crossBorder,'cross-border projection');

assert.throws(() => projectSourcingOpportunityToCrossBorder({sourcingOpportunity:opportunity,origin:'ET',destination:'ET'}));
const executionBearingInput = {...match1, authorization:true, providerExecution:true};
const guardedOpportunity = createSourcingOpportunity({demand,supply,match:executionBearingInput,opportunityId:'guarded'});
assertNoExecutionAuthority(guardedOpportunity,'execution-bearing input projection');

// Different payload under the same logical opportunity must not be treated as replay.
const changed = {...opportunity, status:'CONDITIONAL'};
assert.notEqual(JSON.stringify(opportunity),JSON.stringify(changed));

const contract = phase21AdversarialContract();
assert.equal(contract.deterministicReplay,true);
assert.equal(contract.unknownNeverSuccess,true);
assert.equal(contract.persistence,'none');

console.log('PHASE 21.13 ADVERSARIAL / IDEMPOTENCY REGRESSION: 13 PASS / 0 FAIL');
