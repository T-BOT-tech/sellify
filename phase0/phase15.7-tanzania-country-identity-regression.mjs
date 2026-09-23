import assert from 'node:assert/strict';
import { resolveTanzaniaIdentity, isTanzaniaIdentity, TANZANIA_COUNTRY_IDENTITY_CONTRACT } from '../app/src/tanzania-country-identity.js';
import { getCountryPack, listCountryPacks, validateCountryPack } from '../app/src/country-pack-contract.js';
import { getRegionalCluster } from '../app/src/regional-cluster-contract.js';

const identity = resolveTanzaniaIdentity({ organization: { country: 'Tanzania' }, config: { lang: 'sw' } });
assert.equal(identity.active, true);
assert.equal(identity.countryCode, 'TZ');
assert.equal(identity.currency, 'TZS');
assert.equal(identity.timezone, 'Africa/Dar_es_Salaam');
assert.equal(identity.language, 'sw');
assert.equal(identity.locale, 'sw');
assert.equal(identity.pack.countryCode, 'TZ');
assert.equal(isTanzaniaIdentity(identity), true);

const english = resolveTanzaniaIdentity({ organization: { country: 'TZ', currency: 'TZS' }, config: { lang: 'fr' } });
assert.equal(english.language, 'en');
assert.equal(english.timezone, 'Africa/Dar_es_Salaam');

const explicit = resolveTanzaniaIdentity({ organization: { country: 'United Republic of Tanzania', currency: 'CUSTOM', timezone: 'UTC' }, config: { lang: 'en' } });
assert.equal(explicit.currency, 'CUSTOM');
assert.equal(explicit.timezone, 'UTC');

const nonTanzania = resolveTanzaniaIdentity({ organization: { country: 'Kenya', currency: 'KES' }, config: { lang: 'sw' } });
assert.equal(nonTanzania.active, false);
assert.equal(isTanzaniaIdentity(nonTanzania), false);

assert.deepEqual(listCountryPacks(), ['et', 'ke', 'tz', 'ng']);
const pack = getCountryPack('Tanzania');
assert.equal(pack.currency, 'TZS');
assert.equal(pack.locale, 'en-TZ');
assert.deepEqual(pack.languages, ['en', 'sw']);
assert.deepEqual(pack.paymentProviders.providers, []);
assert.equal(validateCountryPack(pack).valid, true);
assert.ok(getRegionalCluster('EAC').countries.includes('TZ'));
assert.equal(TANZANIA_COUNTRY_IDENTITY_CONTRACT.canonicalCountryAuthority, 'organization.country');
assert.equal(TANZANIA_COUNTRY_IDENTITY_CONTRACT.persistence, 'none');
assert.equal(TANZANIA_COUNTRY_IDENTITY_CONTRACT.ownsIdentity, false);

console.log('Phase 15.7 Tanzania Country Pack Identity / Locale Regression: PASS');
console.log('Tanzania TZ / TZS identity projection: PASS');
console.log('Tanzania en/sw locale boundary preserved: PASS');
console.log('Africa/Dar_es_Salaam timezone remains fallback-only: PASS');
console.log('Tanzania payment provider list remains empty/deferred: PASS');
console.log('EAC regional membership remains composition-only: PASS');
console.log('No country persistence / duplicate identity authority: PASS');
