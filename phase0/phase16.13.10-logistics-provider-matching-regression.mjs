import assert from 'node:assert/strict';
import {
  matchLogisticsProviders,
  projectLogisticsProviderForDiscovery,
  logisticsProviderMatchingContract,
} from '../backend/lib/discovery/logistics-provider-matching.js';

const providers = [
  {
    provider_id: 'carrier-a',
    name: 'Carrier A',
    capabilities: ['delivery', 'tracking'],
    serviceAreas: [{ countryCode: 'ET', geoCode: 'ADDIS_ABABA' }],
    capacitySignals: [{ subjectType: 'CAPABILITY', subjectId: 'delivery', quantity: 100, unit: 'parcel', periodStart: '2026-12-01T00:00:00.000Z', periodEnd: '2026-12-31T23:59:59.999Z', availability: 'AVAILABLE', status: 'ACTIVE', observedAt: '2026-11-19T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', quality: 'SELF_REPORTED' }],
  },
  {
    provider_id: 'carrier-b',
    name: 'Carrier B',
    capabilities: ['delivery'],
    serviceAreas: [{ countryCode: 'KE', geoCode: 'NAIROBI' }],
    capacitySignals: [{ subjectId: 'parcel', quantity: 100, unit: 'parcel' }],
  },
];

const projection = projectLogisticsProviderForDiscovery(providers[0]);
assert.equal(projection.providerId, 'carrier-a');
assert.deepEqual(projection.capabilities.map((item) => item.code), ['delivery', 'tracking']);
assert.equal(projection.capacitySignals[0].periodStart, '2026-12-01T00:00:00.000Z');
assert.equal(projection.capacitySignals[0].availability, 'AVAILABLE');
assert.equal(projection.capacitySignals[0].observedAt, '2026-11-19T00:00:00.000Z');
assert.equal(projection.capacitySignals[0].validUntil, '2027-01-01T00:00:00.000Z');

const matched = matchLogisticsProviders(providers, {
  capability: 'delivery',
  countryCode: 'ET',
  geoCode: 'ADDIS_ABABA',
  minimumQuantity: 20,
  unit: 'parcel',
  availabilityFrom: '2026-12-10T00:00:00.000Z',
  availabilityTo: '2026-12-12T23:59:59.999Z',
});

assert.equal(matched.authority, 'discovery_matching');
assert.equal(matched.candidates.length, 1);
assert.equal(matched.candidates[0].candidate.providerId, 'carrier-a');
assert.equal(matched.candidates[0].match.eligible, true);
assert.equal(matched.selection, 'not_performed');
assert.equal(matched.execution, false);
assert.equal(matched.persistence, 'none');

assert.equal(logisticsProviderMatchingContract().duplicate_matching_authority, false);
const idOnlyProjection = projectLogisticsProviderForDiscovery({
  provider_id: 'x', capabilities: ['delivery'], serviceAreas: [{ countryCode: 'ET' }],
});
assert.equal(idOnlyProjection.title, 'x', 'provider ID is the documented fallback display title when a name is absent');
const unknownStatusProvider = {
  ...providers[0],
  capacitySignals: [{ ...providers[0].capacitySignals[0], status: undefined }],
};
const unknownStatusProjection = projectLogisticsProviderForDiscovery(unknownStatusProvider);
assert.equal(unknownStatusProjection.capacitySignals[0].status, undefined, 'normalization must preserve unknown status');
assert.equal(unknownStatusProjection.capacitySignals[0].source, null, 'normalization must not invent declaration provenance');
assert.equal(unknownStatusProjection.capacitySignals[0].quality, 'SELF_REPORTED', 'explicit supplier-declared quality remains self-reported');
const unknownStatusMatch = matchLogisticsProviders([unknownStatusProvider], {
  capability: 'delivery', countryCode: 'ET', geoCode: 'ADDIS_ABABA',
  minimumQuantity: 20, unit: 'parcel',
  availabilityFrom: '2026-12-10T00:00:00.000Z',
  availabilityTo: '2026-12-12T23:59:59.999Z',
});
assert.equal(unknownStatusMatch.candidates.length, 0, 'missing status cannot satisfy time-bound capacity matching');

const unknownQualityProvider = {
  ...providers[0],
  capacitySignals: [{ ...providers[0].capacitySignals[0], quality: undefined }],
};
const unknownQualityProjection = projectLogisticsProviderForDiscovery(unknownQualityProvider);
assert.equal(unknownQualityProjection.capacitySignals[0].quality, 'UNKNOWN', 'observation timestamps alone do not establish evidence quality');
const unknownQualityMatch = matchLogisticsProviders([unknownQualityProvider], {
  capability: 'delivery', countryCode: 'ET', geoCode: 'ADDIS_ABABA',
  minimumQuantity: 20, unit: 'parcel',
  availabilityFrom: '2026-12-10T00:00:00.000Z',
  availabilityTo: '2026-12-12T23:59:59.999Z',
});
assert.equal(unknownQualityMatch.candidates.length, 0, 'unknown quality cannot satisfy time-bound capacity matching');

console.log('Phase 16.13.10 Logistics Provider Matching Regression: PASS');
