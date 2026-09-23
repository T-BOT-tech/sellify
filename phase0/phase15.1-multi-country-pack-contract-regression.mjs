import assert from 'node:assert/strict';
import {
  COUNTRY_PACK_CONTRACT_VERSION,
  COUNTRY_PACK_FIELDS,
  COUNTRY_PACK_FORBIDDEN_AUTHORITIES,
  assertCountryPack,
  countryPackContract,
  getCountryPack,
  listCountryPacks,
  validateCountryPack,
} from '../app/src/country-pack-contract.js';

const et = getCountryPack('ET');
assert.equal(COUNTRY_PACK_CONTRACT_VERSION, '1.0');
assert.equal(countryPackContract().hardeningRevision, '1.1');
assert.equal(validateCountryPack(et).valid, true);
assert.equal(assertCountryPack(et), et);
assert.deepEqual([...Object.keys(et)].sort(), [...COUNTRY_PACK_FIELDS].sort());
assert.deepEqual(listCountryPacks(), ['et']);
assert.equal(countryPackContract().expansionPolicy, 'additive_country_pack_only');
assert.equal(countryPackContract().persistence, 'none');

for (const authority of COUNTRY_PACK_FORBIDDEN_AUTHORITIES) {
  assert.equal(countryPackContract().countryPackAuthority[authority], false);
}

const malformed = { ...et, countryCode: 'ETH' };
assert.equal(validateCountryPack(malformed).valid, false);
assert.throws(() => assertCountryPack(malformed), (error) => error.code === 'COUNTRY_PACK_INVALID');

const duplicateLanguages = { ...et, languages: ['en', 'en'] };
assert.equal(validateCountryPack(duplicateLanguages).valid, false);

const authorityClaim = { ...et, ownsPayments: true };
const authorityValidation = validateCountryPack(authorityClaim);
assert.equal(authorityValidation.valid, false);
assert.ok(authorityValidation.errors.some((error) => error.includes('forbidden:ownsPayments')));

for (const unsupported of ['US', 'KE', 'NG', 'GB', 'IN']) {
  assert.throws(() => getCountryPack(unsupported), (error) => error.code === 'COUNTRY_PACK_UNKNOWN');
}

console.log('Phase 15.1 Multi-Country Pack Contract Hardening: PASS');
console.log('Contract version 1.1: PASS');
console.log('ET contract compatibility: PASS');
console.log('Future-country validation rules: PASS');
console.log('Forbidden country authority claims rejected: PASS');
console.log('Unsupported countries remain fail-closed: PASS');
console.log('No country persistence / duplicate Core authority: BLOCKED');
