import assert from 'node:assert/strict';
import { discoveryMatchingContract, evaluateDiscoveryMatch, matchDiscoveryCandidates } from '../backend/lib/discovery/matching-contract.js';

const contract = discoveryMatchingContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.persistence, 'none');
assert.equal(contract.eligibilityBeforeRanking, true);
assert.equal(contract.matchScoreDistinctFromTrustScore, true);
assert.equal(contract.aiRanking, false);
assert.equal(contract.transactionExecution, false);
assert.equal(contract.opportunityPersistence, false);

const context = {
  productId: 'coffee', capabilityCode: 'COFFEE', countryCode: 'ET', geoCode: 'KAFFA', currency: 'ETB',
  minimumQuantity: 500, unit: 'kg', wholesale: true, qualificationType: 'EXPORT',
};

const strong = {
  organizationId: 'org-a', organization: { id: 'org-a', name: 'Alpha', country: 'ET' },
  productReference: { productId: 'coffee' },
  capabilities: [{ code: 'COFFEE' }],
  serviceAreas: [{ countryCode: 'ET', geoCode: 'KAFFA' }],
  capacitySignals: [{ subjectId: 'coffee', quantity: 1000, unit: 'kg' }],
  commercialTerms: [{ supportedCurrencies: ['ETB'], wholesaleCapable: true, bulkOrderCapable: true }],
  qualifications: [{ qualificationType: 'EXPORT', status: 'VERIFIED' }],
  relationshipActive: true,
};
const weak = { ...strong, organizationId: 'org-b', organization: { id: 'org-b', name: 'Beta', country: 'ET' }, capacitySignals: [{ subjectId: 'coffee', quantity: 100, unit: 'kg' }], relationshipActive: false };
const unrelated = { ...strong, organizationId: 'org-c', organization: { id: 'org-c', name: 'Gamma', country: 'ET' }, productReference: { productId: 'maize' } };

const m = evaluateDiscoveryMatch(strong, context);
assert.equal(m.eligible, true);
assert.equal(m.matchScore, 100);
assert.equal(m.trustScore, null);
assert.equal(m.deterministic, true);
assert.equal(m.ai, false);
assert.equal(m.hardConstraints.every(x => x.satisfied), true);

const rejected = evaluateDiscoveryMatch(weak, context);
assert.equal(rejected.eligible, false);
assert.equal(rejected.matchScore, null);
assert.equal(rejected.hardConstraints.find(x => x.dimension === 'CAPACITY').satisfied, false);

const rejectedProduct = evaluateDiscoveryMatch(unrelated, context);
assert.equal(rejectedProduct.eligible, false);
assert.equal(rejectedProduct.hardConstraints.find(x => x.dimension === 'PRODUCT').satisfied, false);

const ranked = matchDiscoveryCandidates([weak, strong, unrelated], { ...context, minimumQuantity: null });
assert.equal(ranked.length, 2);
assert.equal(ranked[0].candidate.organizationId, 'org-a');
assert.equal(ranked[0].match.matchScore > ranked[1].match.matchScore, true);

const ties = matchDiscoveryCandidates([
  { organizationId: 'org-z', organization: { name: 'Same' }, productReference: { productId: 'coffee' } },
  { organizationId: 'org-a', organization: { name: 'Same' }, productReference: { productId: 'coffee' } },
], { productId: 'coffee' });
assert.deepEqual(ties.map(x => x.candidate.organizationId), ['org-a', 'org-z']);

console.log('Phase 19.7 Deterministic Matching regression: PASS');
