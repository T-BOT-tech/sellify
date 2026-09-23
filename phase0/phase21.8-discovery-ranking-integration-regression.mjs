import assert from 'node:assert/strict';
import { projectSourcingOpportunityForDiscovery, phase21DiscoveryRankingIntegrationContract } from '../app/src/phase21-discovery-ranking-integration.js';
import { rankDiscoveryMatches, explainableDiscoveryRankingContract } from '../backend/lib/discovery/explainable-ranking.js';

const opportunity = {
  opportunityId: 'opp-1',
  derived: true,
  status: 'ELIGIBLE',
  demandReference: { id: 'd1', authority: 'procurement' },
  commodityReference: { id: 'coffee', authority: 'agriculture' },
  supplierReference: { id: 's1', authority: 'supplier_network' },
  capabilityReference: { id: 'cap-s1', authority: 'supplier_network' },
  evidenceReferences: [{ source: 'capacity-observation', status: 'VERIFIED' }],
};

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('Phase 21 remains projection-only', () => {
  const c = phase21DiscoveryRankingIntegrationContract();
  assert.equal(c.persistence, 'none');
  assert.equal(c.createsMatchScore, false);
  assert.equal(c.createsRank, false);
  assert.equal(c.createsTrustScore, false);
});

test('canonical Discovery match is required', () => assert.throws(() => projectSourcingOpportunityForDiscovery({ opportunity }), /discoveryMatch is required/));

test('eligible Discovery match must carry canonical score', () => assert.throws(() => projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true } }), /canonical Discovery matchScore/));

test('Phase 21 eligibility and Discovery eligibility both gate projection', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70, factors: [], hardConstraints: [] } });
  assert.equal(r.eligible, true);
  assert.equal(r.rankingScore, 70);
});

test('Phase 21 conditional opportunity cannot become Discovery eligible', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity: { ...opportunity, status: 'CONDITIONAL' }, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(r.eligible, false);
  assert.equal(r.rankingScore, null);
});

test('Discovery ineligibility remains ineligible', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: false, matchScore: null } });
  assert.equal(r.eligible, false);
});

test('existing Discovery ranking remains authoritative', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70, factors: [{ dimension: 'CAPABILITY', points: 20 }], hardConstraints: [] } });
  const ranked = rankDiscoveryMatches([{ candidate: r.candidate, index: 0, match: r.discoveryMatch }]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].explanation.rank, 1);
  assert.equal(ranked[0].explanation.matchScore, 70);
  assert.equal(explainableDiscoveryRankingContract().authority, 'discovery_ranking');
});

test('supplier authority is preserved', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(r.candidate.supplierReference.authority, 'supplier_network');
});

test('commodity authority is preserved', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(r.candidate.commodityReference.authority, 'agriculture');
});

test('procurement authority is preserved', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(r.candidate.demandReference.authority, 'procurement');
});

test('no action execution is created', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(r.execution, false);
  assert.deepEqual(r.candidate.actions, []);
});

test('result is immutable', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.candidate), true);
});

test('input opportunity is not mutated', () => {
  const before = JSON.stringify(opportunity);
  projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: true, matchScore: 70 } });
  assert.equal(JSON.stringify(opportunity), before);
});

test('invalid authority is rejected', () => assert.throws(() => projectSourcingOpportunityForDiscovery({ opportunity: { ...opportunity, commodityReference: { id: 'x', authority: 'inventory' } }, discoveryMatch: { eligible: true, matchScore: 70 } }), /agriculture authority/));

test('unknown Discovery match never becomes eligible', () => {
  const r = projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch: { eligible: false, matchScore: null } });
  assert.equal(r.eligible, false);
  assert.equal(r.rankingScore, null);
});

console.log(`PHASE 21.8 DISCOVERY + RANKING INTEGRATION: ${passed} PASS / 0 FAIL`);
