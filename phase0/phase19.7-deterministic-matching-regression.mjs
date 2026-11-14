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

const windowContext = {
  productId: 'coffee',
  minimumQuantity: 50,
  unit: 'kg',
  availabilityFrom: '2026-12-01T00:00:00.000Z',
  availabilityTo: '2026-12-03T23:59:59.999Z',
};
const temporalCandidate = {
  ...strong,
  capacitySignals: [{
    id: 'cap-window', subjectType: 'PRODUCT', subjectId: 'coffee',
    quantity: 75, unit: 'kg', periodType: 'RANGE',
    periodStart: '2026-12-01T00:00:00.000Z', periodEnd: '2026-12-05T00:00:00.000Z',
    availability: 'LIMITED', status: 'ACTIVE', source: 'DECLARED',
  }],
};
assert.equal(evaluateDiscoveryMatch(temporalCandidate, windowContext).eligible, true, 'overlapping LIMITED declared capacity qualifies');
for (const availability of ['UNAVAILABLE', 'ON_REQUEST']) {
  const result = evaluateDiscoveryMatch({
    ...temporalCandidate,
    capacitySignals: [{ ...temporalCandidate.capacitySignals[0], availability }],
  }, windowContext);
  assert.equal(result.eligible, false, `${availability} must not satisfy a time-bound availability request`);
}
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], periodStart: '2026-12-04T00:00:00.000Z', periodEnd: '2026-12-06T00:00:00.000Z' }],
}, windowContext).eligible, false, 'non-overlapping capacity window is excluded');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], periodStart: null, periodEnd: null }],
}, windowContext).eligible, false, 'capacity without a declared period is UNKNOWN for a time-bound request');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], quantity: 10 }],
}, windowContext).eligible, false, 'insufficient quantity is excluded');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], unit: 'tonne' }],
}, windowContext).eligible, false, 'incompatible units are not converted implicitly');
assert.equal(evaluateDiscoveryMatch(temporalCandidate, {
  ...windowContext, availabilityTo: null,
}).eligible, false, 'incomplete requested window fails closed');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], subjectType: 'CAPABILITY', subjectId: 'COFFEE' }],
}, { ...windowContext, productId: null, capabilityCode: 'COFFEE' }).eligible, true, 'capability-bound capacity matches capability requests');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capabilities: [{ id: 'cap-coffee-id', code: 'COFFEE' }],
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], subjectType: 'CAPABILITY', subjectId: 'cap-coffee-id' }],
}, { ...windowContext, productId: null, capabilityCode: 'COFFEE' }).eligible, true, 'canonical capability IDs bind capacity to the matching capability');
assert.equal(evaluateDiscoveryMatch(temporalCandidate, { productId: 'coffee', minimumQuantity: 50, unit: 'kg' }).eligible, true, 'legacy searches without a requested period retain prior quantity behavior');

console.log('Phase 19.7 Deterministic Matching regression: PASS');
