import assert from 'node:assert/strict';
import {
  STRATEGIC_MARKET_CONTRACT_VERSION,
  STRATEGIC_MARKET_FORBIDDEN_AUTHORITIES,
  listStrategicAfricanMarkets,
  getStrategicAfricanMarket,
  validateStrategicAfricanMarket,
  assertStrategicAfricanMarket,
  strategicAfricanMarketContract
} from '../app/src/strategic-market-contract.js';
import { getCountryPack } from '../app/src/country-pack-contract.js';
import { getRegionalCluster } from '../app/src/regional-cluster-contract.js';

assert.equal(STRATEGIC_MARKET_CONTRACT_VERSION, '1.0');
assert.deepEqual(listStrategicAfricanMarkets(), ['gh', 'zm']);

const ghana = getStrategicAfricanMarket('GH');
assert.equal(ghana.countryCode, 'GH');
assert.equal(ghana.currency, 'GHS');
assert.deepEqual(ghana.languageSignals, ['en']);
assert.equal(ghana.tier, 1);
assert.equal(ghana.activationStatus, 'candidate_only');
assert.equal(validateStrategicAfricanMarket(ghana).valid, true);
assert.doesNotThrow(() => assertStrategicAfricanMarket(ghana));

const zambia = getStrategicAfricanMarket('ZM');
assert.equal(zambia.countryCode, 'ZM');
assert.equal(zambia.currency, 'ZMW');
assert.deepEqual(zambia.languageSignals, ['en']);
assert.equal(zambia.tier, 2);
assert.equal(zambia.activationStatus, 'candidate_only');
assert.equal(validateStrategicAfricanMarket(zambia).valid, true);
assert.doesNotThrow(() => assertStrategicAfricanMarket(zambia));

for (const authority of STRATEGIC_MARKET_FORBIDDEN_AUTHORITIES) {
  const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
  const invalid = { ...ghana, [property]: true };
  assert.equal(validateStrategicAfricanMarket(invalid).valid, false, `${property} must fail closed`);
}

assert.throws(() => getStrategicAfricanMarket('ET'), (error) => error.code === 'STRATEGIC_MARKET_UNKNOWN');
assert.equal(getCountryPack('Ethiopia').countryCode, 'ET');
assert.equal(getCountryPack('Kenya').countryCode, 'KE');
assert.equal(getCountryPack('Tanzania').countryCode, 'TZ');
assert.equal(getCountryPack('Nigeria').countryCode, 'NG');
assert.equal(getRegionalCluster('EAC').regionCode, 'EAC');
assert.equal(getRegionalCluster('WAEMU').regionCode, 'WAEMU');
assert.equal(getRegionalCluster('CEMAC').regionCode, 'CEMAC');

const contract = strategicAfricanMarketContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.activation, 'manual_country_overlay_gate');
assert.equal(contract.countryOverlayRequired, true);
assert.equal(contract.implementationStatus, 'contract_only');
for (const key of [
  'ownsCoreCommerce',
  'ownsInventory',
  'ownsPayments',
  'ownsIdentity',
  'ownsAuthorization',
  'ownsAudit',
  'ownsEvents',
  'ownsTaxLedger',
  'ownsInvoiceAuthority'
]) assert.equal(contract[key], false, `${key} must remain false`);

console.log('Phase 15.10 Other Strategic African Markets Regression: PASS');
console.log('Ghana candidate contract: PASS');
console.log('Zambia candidate contract: PASS');
console.log('Candidate-only / manual country-overlay boundary: PASS');
console.log('Forbidden authority claims fail closed: PASS');
console.log('Existing Ethiopia / Kenya / Tanzania / Nigeria packs remain independent: PASS');
console.log('Existing EAC / WAEMU / CEMAC regional clusters remain independent: PASS');
