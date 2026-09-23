import assert from 'node:assert/strict';
import {
  REGIONAL_CLUSTER_CONTRACT_VERSION,
  REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES,
  getRegionalCluster,
  listRegionalClusters,
  validateRegionalCluster,
  assertRegionalCluster,
  regionalClusterContract
} from '../app/src/regional-cluster-contract.js';
import { getCountryPack } from '../app/src/country-pack-contract.js';

const eac = getRegionalCluster('EAC');

assert.equal(REGIONAL_CLUSTER_CONTRACT_VERSION, '1.0');
assert.deepEqual(listRegionalClusters(), ['eac']);
assert.equal(eac.regionCode, 'EAC');
assert.deepEqual(eac.countries, ['BI', 'CD', 'KE', 'RW', 'SO', 'SS', 'TZ', 'UG']);
assert.equal(new Set(eac.countries).size, 8);
assert.equal(eac.currencyStrategy.mode, 'country_currency');
assert.equal(eac.currencyStrategy.commonCurrency, null);
assert.equal(eac.countryOverlayRequired, true);
assert.equal(eac.implementationStatus, 'contract_only');
assert.deepEqual(eac.sharedLanguages, ['en', 'sw']);
assert.equal(eac.tradeFramework.customsUnion, true);
assert.equal(eac.tradeFramework.commonMarket, true);
assert.equal(eac.tradeFramework.singleCustomsTerritory, true);
assert.equal(eac.taxStrategy.mode, 'regional_harmonization_plus_country_overlay');
assert.equal(eac.paymentStrategy.execution, 'existing_payment_authority_only');
assert.equal(validateRegionalCluster(eac).valid, true);
assert.equal(assertRegionalCluster(eac), eac);

// Country packs remain independent overlays. Existing installed packs are not
// replaced or made regional authorities by this contract.
assert.equal(getCountryPack('KE').countryCode, 'KE');
assert.equal(getCountryPack('NG').countryCode, 'NG');
assert.equal(getCountryPack('ET').countryCode, 'ET');

const bad = {
  ...eac,
  countries: [...eac.countries, 'KE'],
  ownsPayments: true
};
const badResult = validateRegionalCluster(bad);
assert.equal(badResult.valid, false);
assert.ok(badResult.errors.includes('countries must be unique'));
assert.ok(badResult.errors.includes('forbidden:ownsPayments'));

assert.throws(() => getRegionalCluster('WAEMU'), (error) => error.code === 'REGIONAL_CLUSTER_UNKNOWN');
assert.throws(() => assertRegionalCluster({ ...eac, countryOverlayRequired: false }), (error) => error.code === 'REGIONAL_CLUSTER_INVALID');

const contract = regionalClusterContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.ownsCoreCommerce, false);
assert.equal(contract.ownsInventory, false);
assert.equal(contract.ownsPayments, false);
assert.equal(contract.ownsIdentity, false);
assert.equal(contract.ownsAuthorization, false);
assert.equal(contract.ownsAudit, false);
assert.equal(contract.ownsEvents, false);
assert.equal(contract.ownsTaxLedger, false);
assert.equal(contract.ownsInvoiceAuthority, false);
assert.equal(contract.countryOverlayRequired, true);
assert.equal(contract.implementationStatus, 'contract_only');

for (const authority of REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES) {
  assert.ok(authority.length > 0);
}

console.log('Phase 15.5 Regional Cluster Contract Regression: PASS');
console.log('EAC regional cluster contract: PASS');
console.log('Eight current EAC member-country overlays represented exactly once: PASS');
console.log('Country-specific currency strategy preserved: PASS');
console.log('Country overlay remains mandatory: PASS');
console.log('Forbidden regional authority claims fail closed: PASS');
console.log('Existing ET / KE / NG country packs remain independent: PASS');
