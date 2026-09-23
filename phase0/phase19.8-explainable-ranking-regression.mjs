import assert from 'node:assert/strict';
import { evaluateDiscoveryMatch, matchDiscoveryCandidates } from '../backend/lib/discovery/matching-contract.js';
import { explainDiscoveryMatch, rankDiscoveryMatches, explainableDiscoveryRankingContract } from '../backend/lib/discovery/explainable-ranking.js';

const contract = explainableDiscoveryRankingContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.persistence, 'none');
assert.equal(contract.consumesDeterministicMatchOnly, true);
assert.equal(contract.preservesMatchScore, true);
assert.equal(contract.matchScoreDistinctFromTrustScore, true);
assert.equal(contract.trustScoreOwnedElsewhere, true);
assert.equal(contract.aiRanking, false);
assert.equal(contract.transactionExecution, false);
assert.equal(contract.opportunityPersistence, false);

const context = { productId: 'coffee', countryCode: 'ET' };
const alpha = { organizationId: 'org-a', organization: { id: 'org-a', name: 'Alpha', country: 'ET' }, productReference: { productId: 'coffee' }, serviceAreas: [{ countryCode: 'ET', geoCode: 'KAFFA' }], relationshipActive: true };
const beta = { organizationId: 'org-b', organization: { id: 'org-b', name: 'Beta', country: 'ET' }, productReference: { productId: 'coffee' }, relationshipActive: false };
const gamma = { organizationId: 'org-c', organization: { id: 'org-c', name: 'Gamma', country: 'KE' }, productReference: { productId: 'coffee' } };

const evaluated = matchDiscoveryCandidates([beta, alpha, gamma], context);
assert.equal(evaluated.length, 2);
assert.equal(evaluated[0].candidate.organizationId, 'org-a');
assert.equal(evaluated[0].match.matchScore, 50);
assert.equal(evaluated[0].match.trustScore, null);

const ranked = rankDiscoveryMatches(evaluated);
assert.deepEqual(ranked.map(x => x.explanation.rank), [1, 2]);
assert.equal(ranked[0].explanation.matchScore, evaluated[0].match.matchScore);
assert.equal(ranked[0].explanation.candidate.source, null);
assert.equal(ranked[0].explanation.deterministic, true);
assert.equal(ranked[0].explanation.ai, false);
assert.equal(ranked[0].explanation.trustScore, null);
assert.equal(ranked[0].explanation.factors.some(f => f.dimension === 'PRODUCT'), true);
assert.equal(ranked[0].explanation.factors.some(f => f.dimension === 'RELATIONSHIP'), true);
assert.equal(ranked[0].explanation.hardConstraints.every(c => !c.requested || c.satisfied), true);

const direct = explainDiscoveryMatch(gamma, { eligible: false, matchScore: null, trustScore: 87, deterministic: true, ai: false, factors: [], hardConstraints: [{ dimension: 'GEOGRAPHY', requested: true, satisfied: false }] });
assert.equal(direct.eligible, false);
assert.equal(direct.matchScore, null);
assert.equal(direct.trustScore, 87);
assert.equal(direct.explanation.failedHardConstraintCount, 1);
assert.match(direct.explanation.summary, /excluded/i);

const tied = rankDiscoveryMatches([
  { candidate: { organizationId: 'org-z', organization: { name: 'Same' } }, index: 1, match: { eligible: true, matchScore: 30, factors: [], hardConstraints: [], trustScore: null } },
  { candidate: { organizationId: 'org-a', organization: { name: 'Same' } }, index: 0, match: { eligible: true, matchScore: 30, factors: [], hardConstraints: [], trustScore: null } },
]);
assert.deepEqual(tied.map(x => x.candidate.organizationId), ['org-a', 'org-z']);

console.log('Phase 19.8 Explainable Ranking regression: PASS');
