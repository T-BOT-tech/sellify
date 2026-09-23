import assert from 'node:assert/strict';
import { buildDiscoveryOpportunity, buildDiscoveryOpportunities, discoveryOpportunityContract } from '../backend/lib/discovery/index.js';

const candidate = {
  source: 'supplier-network', sourceAuthority: 'supplier_network', sourceEntityId: 'org-42',
  entityType: 'supplier', organizationId: 'org-42', organization: { id: 'org-42', name: 'Alpha Supplier' },
  productReference: { productId: 'coffee-1' },
  evidence: [{ type: 'QUALIFICATION', sourceAuthority: 'supplier_network', sourceEntityId: 'q-1' }],
  actions: [
    { action: 'view-supplier-network', method: 'GET', path: '/tenants/:chatId/supplier-network/discovery', sourceAuthority: 'supplier_network', sourceEntityId: 'org-42' },
    { action: 'request-quote', method: 'POST', path: '/tenants/:chatId/procurement/rfqs', sourceAuthority: 'procurement', sourceEntityId: 'org-42', requires: { supplierOrganizationId: 'org-42' } },
  ],
};
const explanation = {
  eligible: true, rank: 1, matchScore: 85,
  factors: [{ dimension: 'PRODUCT', points: 30, reason: 'Canonical product match' }],
  hardConstraints: [{ dimension: 'PRODUCT', requested: true, satisfied: true }],
};
const context = { productId: 'coffee-1', minimumQuantity: 5, unit: 'ton' };

const contract = discoveryOpportunityContract();
assert.equal(contract.derived, true);
assert.equal(contract.persistence, 'none');
assert.equal(contract.actionExecution, false);
assert.equal(contract.owningDomainExecutesActions, true);
assert.equal(contract.aiRanking, false);
console.log('PASS contract invariants');

const opportunity = buildDiscoveryOpportunity({ intent: context, candidate, explanation });
assert.ok(opportunity);
assert.equal(opportunity.derived, true);
assert.equal(opportunity.persistent, false);
assert.equal(opportunity.match.matchScore, 85);
assert.equal(opportunity.match.rank, 1);
assert.equal(opportunity.candidate.organizationId, 'org-42');
assert.equal(opportunity.evidence.length, 1);
assert.equal(opportunity.actions.length, 2);
assert.equal(opportunity.actions[1].sourceAuthority, 'procurement');
assert.equal(opportunity.execution.executableHere, false);
console.log('PASS opportunity composition and provenance');

const same = buildDiscoveryOpportunity({ intent: context, candidate, explanation });
assert.equal(opportunity.opportunityId, same.opportunityId);
console.log('PASS deterministic opportunity identity');

const rejected = buildDiscoveryOpportunity({ intent: context, candidate, explanation: { ...explanation, eligible: false } });
assert.equal(rejected, null);
console.log('PASS ineligible candidates cannot become opportunities');

const ranked = buildDiscoveryOpportunities([{ candidate, explanation }], context);
assert.equal(ranked.length, 1);
assert.equal(ranked[0].actions[0].method, 'GET');
console.log('PASS batch derivation');

const badAction = buildDiscoveryOpportunity({ intent: context, candidate: { ...candidate, actions: [{ action: 'bad', method: 'GET', path: 'not-absolute' }] }, explanation });
assert.equal(badAction.actions.length, 0);
console.log('PASS action-link boundary');

assert.equal(opportunity.deterministic, true);
assert.equal(opportunity.ai, false);
console.log('PASS AI/execution boundary');
console.log('PHASE 19.9 OPPORTUNITY MODEL: PASS');
