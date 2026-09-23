import assert from 'node:assert/strict';
import {
  crossRegionCountryStatus,
  regionsForCountry,
  resolveCrossRegionBoundary,
  crossRegionIntegrationContract,
} from '../app/src/cross-region-integration-contract.js';

assert.equal(crossRegionCountryStatus('ET'), 'active_country_pack');
assert.equal(crossRegionCountryStatus('KE'), 'active_country_pack');
assert.equal(crossRegionCountryStatus('TZ'), 'active_country_pack');
assert.equal(crossRegionCountryStatus('NG'), 'active_country_pack');
assert.equal(crossRegionCountryStatus('GH'), 'strategic_candidate');
assert.equal(crossRegionCountryStatus('ZM'), 'strategic_candidate');
assert.equal(crossRegionCountryStatus('UG'), 'regional_country_boundary_only');
assert.equal(crossRegionCountryStatus('US'), 'unknown');

assert.deepEqual(regionsForCountry('KE'), ['eac']);
assert.deepEqual(regionsForCountry('TZ'), ['eac']);
assert.deepEqual(regionsForCountry('ET'), []);
assert.deepEqual(regionsForCountry('NG'), []);
assert.deepEqual(regionsForCountry('BJ'), ['waemu']);
assert.deepEqual(regionsForCountry('CM'), ['cemac']);

const sameRegion = resolveCrossRegionBoundary({ fromCountry: 'KE', toCountry: 'TZ' });
assert.equal(sameRegion.fromCountry, 'KE');
assert.equal(sameRegion.toCountry, 'TZ');
assert.equal(sameRegion.sameRegion, true);
assert.deepEqual(sameRegion.fromRegions, ['eac']);
assert.equal(sameRegion.regionalExecution, 'none');
assert.equal(sameRegion.persistence, 'none');
assert.equal(sameRegion.settlement, 'existing_payment_authority_only');
assert.equal(sameRegion.events, 'existing_versioned_event_and_outbox_only');

const crossRegion = resolveCrossRegionBoundary({ fromCountry: 'ET', toCountry: 'KE' });
assert.equal(crossRegion.sameRegion, false);
assert.deepEqual(crossRegion.fromRegions, []);
assert.deepEqual(crossRegion.toRegions, ['eac']);
assert.equal(crossRegion.integrationMode, 'country_overlay_plus_existing_core_capability');

assert.throws(
  () => resolveCrossRegionBoundary({ fromCountry: 'KE', toCountry: 'GH' }),
  (error) => error.code === 'CROSS_REGION_COUNTRY_INACTIVE'
);
assert.throws(
  () => resolveCrossRegionBoundary({ fromCountry: 'ET', toCountry: 'US' }),
  (error) => error.code === 'CROSS_REGION_COUNTRY_UNKNOWN'
);

const contract = crossRegionIntegrationContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.regionalExecution, 'none');
assert.equal(contract.ownsRegionalTransaction, false);
assert.equal(contract.ownsRegionalLedger, false);
assert.equal(contract.ownsCrossRegionSettlement, false);
assert.equal(contract.ownsPayments, false);
assert.equal(contract.ownsEvents, false);
assert.equal(contract.ownsTaxLedger, false);
assert.equal(contract.ownsInvoiceAuthority, false);
assert.equal(contract.failClosed, true);

console.log('Phase 15.19 Cross-Region Integration Regression: PASS');
