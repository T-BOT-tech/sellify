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
    capacitySignals: [{ subjectType: 'CAPABILITY', subjectId: 'delivery', quantity: 100, unit: 'parcel', periodStart: '2026-12-01T00:00:00.000Z', periodEnd: '2026-12-31T23:59:59.999Z', availability: 'AVAILABLE', status: 'ACTIVE' }],
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
assert.throws(
  () => projectLogisticsProviderForDiscovery({ provider_id: 'x', capabilities: ['delivery'], serviceAreas: [{ countryCode: 'ET' }] }),
  /provider name must be a non-empty string/,
);

console.log('Phase 16.13.10 Logistics Provider Matching Regression: PASS');
