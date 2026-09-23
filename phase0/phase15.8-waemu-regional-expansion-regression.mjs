import assert from 'node:assert/strict';
import { getRegionalCluster, listRegionalClusters, validateRegionalCluster, REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES } from '../app/src/regional-cluster-contract.js';
import { getCountryPack } from '../app/src/country-pack-contract.js';

const waemu = getRegionalCluster('WAEMU');
assert.equal(waemu.regionCode, 'WAEMU');
assert.deepEqual(waemu.countries, ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG']);
assert.deepEqual(waemu.sharedLanguages, ['fr']);
assert.equal(waemu.currencyStrategy.commonCurrency, 'XOF');
assert.equal(waemu.currencyStrategy.mode, 'shared_currency');
assert.equal(waemu.tradeFramework.customsUnion, true);
assert.equal(waemu.tradeFramework.commonMarket, true);
assert.equal(waemu.countryOverlayRequired, true);
assert.equal(waemu.implementationStatus, 'contract_only');
assert.equal(validateRegionalCluster(waemu).valid, true);
assert.ok(listRegionalClusters().includes('eac'));
assert.ok(listRegionalClusters().includes('waemu'));

const forbidden = REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES[0];
const invalid = { ...waemu, [`owns${forbidden[0].toUpperCase()}${forbidden.slice(1)}`]: true };
assert.equal(validateRegionalCluster(invalid).valid, false);

assert.equal(getCountryPack('ET').countryCode, 'ET');
assert.equal(getCountryPack('KE').countryCode, 'KE');
assert.equal(getCountryPack('TZ').countryCode, 'TZ');
assert.equal(getCountryPack('NG').countryCode, 'NG');

console.log('Phase 15.8 WAEMU Regional Expansion Regression: PASS');
console.log('Eight official WAEMU member-country references represented exactly once: PASS');
console.log('Shared XOF currency reference remains contract-only: PASS');
console.log('French shared-language signal remains non-authoritative: PASS');
console.log('Customs/common-market metadata remains regional contract-only: PASS');
console.log('Country overlay remains mandatory: PASS');
console.log('Forbidden regional authority claims fail closed: PASS');
console.log('Existing EAC and ET/KE/TZ/NG country packs remain independent: PASS');
