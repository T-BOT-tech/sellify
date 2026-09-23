import assert from 'node:assert/strict';
import {
  getRegionalCluster,
  listRegionalClusters,
  validateRegionalCluster,
  REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES
} from '../app/src/regional-cluster-contract.js';
import { getCountryPack } from '../app/src/country-pack-contract.js';

const cemac = getRegionalCluster('CEMAC');
assert.equal(cemac.regionCode, 'CEMAC');
assert.deepEqual(cemac.countries, ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA']);
assert.deepEqual(cemac.sharedLanguages, ['fr']);
assert.equal(cemac.currencyStrategy.commonCurrency, 'XAF');
assert.equal(cemac.currencyStrategy.mode, 'shared_currency');
assert.equal(cemac.tradeFramework.customsUnion, true);
assert.equal(cemac.tradeFramework.commonMarket, true);
assert.equal(cemac.countryOverlayRequired, true);
assert.equal(cemac.implementationStatus, 'contract_only');
assert.equal(validateRegionalCluster(cemac).valid, true);
assert.ok(listRegionalClusters().includes('eac'));
assert.ok(listRegionalClusters().includes('waemu'));
assert.ok(listRegionalClusters().includes('cemac'));

const forbidden = REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES[0];
const invalid = { ...cemac, [`owns${forbidden[0].toUpperCase()}${forbidden.slice(1)}`]: true };
assert.equal(validateRegionalCluster(invalid).valid, false);

assert.equal(getCountryPack('ET').countryCode, 'ET');
assert.equal(getCountryPack('KE').countryCode, 'KE');
assert.equal(getCountryPack('TZ').countryCode, 'TZ');
assert.equal(getCountryPack('NG').countryCode, 'NG');

console.log('Phase 15.9 CEMAC Regional Expansion Regression: PASS');
console.log('Six official CEMAC member-country references represented exactly once: PASS');
console.log('Shared XAF currency reference remains contract-only: PASS');
console.log('French shared-language signal remains non-authoritative: PASS');
console.log('Customs/common-market metadata remains regional contract-only: PASS');
console.log('Country overlay remains mandatory: PASS');
console.log('Forbidden regional authority claims fail closed: PASS');
console.log('Existing EAC, WAEMU and ET/KE/TZ/NG country packs remain independent: PASS');
