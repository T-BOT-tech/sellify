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
  evaluatedAt: '2026-11-20T00:00:00.000Z',
};
const temporalCandidate = {
  ...strong,
  capacitySignals: [{
    id: 'cap-window', subjectType: 'PRODUCT', subjectId: 'coffee',
    quantity: 75, unit: 'kg', periodType: 'RANGE',
    periodStart: '2026-12-01T00:00:00.000Z', periodEnd: '2026-12-05T00:00:00.000Z',
    availability: 'LIMITED', status: 'ACTIVE', source: 'DECLARED',
    observedAt: '2026-11-19T00:00:00.000Z', validUntil: '2026-12-10T00:00:00.000Z',
  }],
};
assert.equal(evaluateDiscoveryMatch(temporalCandidate, windowContext).eligible, true, 'overlapping LIMITED declared capacity qualifies');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], validUntil: windowContext.availabilityTo }],
}, windowContext).eligible, true, 'validity exactly at requested window end qualifies');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], validUntil: '2026-12-03T23:59:59.998Z' }],
}, windowContext).eligible, false, 'validity one millisecond before requested window end is rejected');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], availability: 'AVAILABLE' }],
}, windowContext).eligible, true, 'overlapping AVAILABLE declared capacity qualifies');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], status: 'INACTIVE' }],
}, windowContext).eligible, false, 'inactive capacity is excluded');

for (const status of [undefined, null, 'UNKNOWN', 'INACTIVE']) {
  assert.equal(evaluateDiscoveryMatch({
    ...temporalCandidate,
    capacitySignals: [{ ...temporalCandidate.capacitySignals[0], status }],
  }, windowContext).eligible, false, `capacity status ${String(status)} must fail closed`);
}
assert.equal(evaluateDiscoveryMatch(temporalCandidate, {
  ...windowContext, evaluatedAt: '2026-11-20T00:00:00',
}).eligible, false, 'timezone-less evaluation instant is rejected');
assert.equal(evaluateDiscoveryMatch(temporalCandidate, {
  ...windowContext, evaluatedAt: '2026-11-20',
}).eligible, false, 'date-only evaluation instant is rejected');
assert.equal(evaluateDiscoveryMatch(temporalCandidate, {
  ...windowContext, availabilityFrom: '2026-12-01',
}).eligible, false, 'date-only requested instant is rejected');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], observedAt: '2026-11-19T00:00:00' }],
}, windowContext).eligible, false, 'timezone-less observation instant is rejected');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], validUntil: '2026-12-10T00:00:00' }],
}, windowContext).eligible, false, 'timezone-less validity instant is rejected');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{
    ...temporalCandidate.capacitySignals[0],
    observedAt: '2026-11-19T03:00:00+03:00',
    validUntil: '2026-12-10T03:00:00+03:00',
  }],
}, windowContext).eligible, true, 'explicit timezone offsets are accepted');
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
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], observedAt: null }],
}, windowContext).eligible, false, 'unknown observation time cannot satisfy a time-bound availability request');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], validUntil: null }],
}, windowContext).eligible, false, 'missing explicit validity cannot satisfy a time-bound availability request');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], validUntil: '2026-11-19T23:59:59.999Z' }],
}, windowContext).eligible, false, 'expired evidence is excluded');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], observedAt: '2026-11-21T00:00:00.000Z' }],
}, windowContext).eligible, false, 'future observation timestamps are excluded');
assert.equal(evaluateDiscoveryMatch(temporalCandidate, {
  ...windowContext, evaluatedAt: null,
}).eligible, false, 'time-bound matching without a server evaluation time fails closed');
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

const temporalOnlyContext = { ...windowContext, minimumQuantity: null, unit: null };
const temporalOnlyMatch = evaluateDiscoveryMatch(temporalCandidate, temporalOnlyContext);
assert.equal(temporalOnlyMatch.eligible, true, 'temporal-only request must enforce matching capacity');
assert.equal(temporalOnlyMatch.hardConstraints.find(x => x.dimension === 'CAPACITY').requested, true, 'temporal-only request activates CAPACITY hard constraint');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [],
}, temporalOnlyContext).eligible, false, 'temporal-only request without capacity fails closed');
assert.equal(evaluateDiscoveryMatch({
  ...temporalCandidate,
  capacitySignals: [{ ...temporalCandidate.capacitySignals[0], periodStart: '2026-12-04T00:00:00.000Z', periodEnd: '2026-12-06T00:00:00.000Z' }],
}, temporalOnlyContext).eligible, false, 'temporal-only request rejects non-overlapping capacity');

assert.equal(evaluateDiscoveryMatch(temporalCandidate, { productId: 'coffee', minimumQuantity: 50, unit: 'kg' }).eligible, true, 'legacy searches without a requested period retain prior quantity behavior');

console.log('Phase 19.7 Deterministic Matching regression: PASS');
