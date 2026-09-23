import assert from 'node:assert/strict';
import { resolveNigeriaIdentity, isNigeriaIdentity, NIGERIA_COUNTRY_IDENTITY_CONTRACT } from '../app/src/nigeria-country-identity.js';
import { getCountryPack, listCountryPacks } from '../app/src/country-pack-contract.js';

const identity = resolveNigeriaIdentity({ organization: { country: 'Nigeria' }, config: { lang: 'ha' } });
assert.equal(identity.active, true);
assert.equal(identity.countryCode, 'NG');
assert.equal(identity.currency, 'NGN');
assert.equal(identity.timezone, 'Africa/Lagos');
assert.equal(identity.language, 'ha');
assert.equal(identity.locale, 'ha');
assert.equal(identity.pack.countryCode, 'NG');
assert.equal(isNigeriaIdentity(identity), true);

const english = resolveNigeriaIdentity({ organization: { country: 'NG', currency: 'NGN' }, config: { lang: 'fr' } });
assert.equal(english.language, 'en');
assert.equal(english.timezone, 'Africa/Lagos');

const explicit = resolveNigeriaIdentity({ organization: { country: 'Nigeria', currency: 'CUSTOM', timezone: 'UTC' }, config: { lang: 'yo' } });
assert.equal(explicit.currency, 'CUSTOM');
assert.equal(explicit.timezone, 'UTC');
assert.equal(explicit.language, 'yo');

const nonNigeria = resolveNigeriaIdentity({ organization: { country: 'Kenya', currency: 'KES' }, config: { lang: 'sw' } });
assert.equal(nonNigeria.active, false);
assert.equal(isNigeriaIdentity(nonNigeria), false);

assert.deepEqual(listCountryPacks(), ['et', 'ke', 'ng']);
assert.equal(getCountryPack('Nigeria').currency, 'NGN');
assert.equal(getCountryPack('ng').locale, 'en-NG');
assert.deepEqual(getCountryPack('NG').languages, ['en', 'ha', 'ig', 'yo']);
assert.deepEqual(getCountryPack('NG').paymentProviders.providers, []);
assert.equal(NIGERIA_COUNTRY_IDENTITY_CONTRACT.canonicalCountryAuthority, 'organization.country');
assert.equal(NIGERIA_COUNTRY_IDENTITY_CONTRACT.persistence, 'none');
assert.equal(NIGERIA_COUNTRY_IDENTITY_CONTRACT.ownsIdentity, false);

console.log('Phase 15.3 Nigeria Country Pack Identity / Locale Regression: PASS');
console.log('Nigeria NG / NGN identity projection: PASS');
console.log('Nigeria en/ha/ig/yo locale boundary preserved: PASS');
console.log('Africa/Lagos timezone remains fallback-only: PASS');
console.log('No country persistence / duplicate identity authority: PASS');
