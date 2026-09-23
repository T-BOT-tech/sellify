import assert from 'node:assert/strict';
import { resolveKenyaIdentity, isKenyaIdentity, KENYA_COUNTRY_IDENTITY_CONTRACT } from '../app/src/kenya-country-identity.js';
import { getCountryPack, listCountryPacks } from '../app/src/country-pack-contract.js';

const identity = resolveKenyaIdentity({ organization: { country: 'Kenya' }, config: { lang: 'sw' } });
assert.equal(identity.active, true);
assert.equal(identity.countryCode, 'KE');
assert.equal(identity.currency, 'KES');
assert.equal(identity.timezone, 'Africa/Nairobi');
assert.equal(identity.language, 'sw');
assert.equal(identity.locale, 'sw');
assert.equal(identity.pack.countryCode, 'KE');
assert.equal(isKenyaIdentity(identity), true);

const english = resolveKenyaIdentity({ organization: { country: 'KE', currency: 'KES' }, config: { lang: 'fr' } });
assert.equal(english.language, 'en');
assert.equal(english.timezone, 'Africa/Nairobi');

const explicit = resolveKenyaIdentity({ organization: { country: 'Kenya', currency: 'CUSTOM', timezone: 'UTC' }, config: { lang: 'en' } });
assert.equal(explicit.currency, 'CUSTOM');
assert.equal(explicit.timezone, 'UTC');

const nonKenya = resolveKenyaIdentity({ organization: { country: 'Ethiopia', currency: 'ETB' }, config: { lang: 'am' } });
assert.equal(nonKenya.active, false);
assert.equal(isKenyaIdentity(nonKenya), false);

assert.deepEqual(listCountryPacks(), ['et', 'ke']);
assert.equal(getCountryPack('Kenya').currency, 'KES');
assert.equal(getCountryPack('ke').locale, 'en-KE');
assert.deepEqual(getCountryPack('KE').languages, ['en', 'sw']);
assert.equal(KENYA_COUNTRY_IDENTITY_CONTRACT.canonicalCountryAuthority, 'organization.country');
assert.equal(KENYA_COUNTRY_IDENTITY_CONTRACT.persistence, 'none');
assert.equal(KENYA_COUNTRY_IDENTITY_CONTRACT.ownsIdentity, false);

console.log('Phase 15.2 Kenya Country Pack Identity / Locale Regression: PASS');
console.log('Kenya KE / KES identity projection: PASS');
console.log('Kenya en/sw locale boundary preserved: PASS');
console.log('Africa/Nairobi timezone remains fallback-only: PASS');
console.log('No country persistence / duplicate identity authority: PASS');
