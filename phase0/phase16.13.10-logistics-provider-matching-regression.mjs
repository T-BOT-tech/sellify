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
    capacitySignals: [{ subjectId: 'parcel', quantity: 100, unit: 'parcel' }],
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

const matched = matchLogisticsProviders(providers, {
  capability: 'delivery',
  countryCode: 'ET',
  geoCode: 'ADDIS_ABABA',
  minimumQuantity: 20,
  unit: 'parcel',
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
