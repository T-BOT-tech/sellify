import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolveEthiopiaIdentity, isEthiopiaIdentity, ETHIOPIA_COUNTRY_IDENTITY_CONTRACT } from '../app/src/ethiopia-country-identity.js';
import { getCountryPack } from '../app/src/country-pack-contract.js';

const identity = resolveEthiopiaIdentity({
  organization: { country: 'Ethiopia', currency: 'ETB', timezone: 'Africa/Addis_Ababa' },
  config: { lang: 'am', currencyCode: 'ETB' }
});
assert.equal(identity.active, true);
assert.equal(identity.countryCode, 'ET');
assert.equal(identity.currency, 'ETB');
assert.equal(identity.timezone, 'Africa/Addis_Ababa');
assert.equal(identity.language, 'am');
assert.equal(identity.locale, 'am');
assert.equal(identity.pack.countryCode, getCountryPack('ET').countryCode);
assert.equal(isEthiopiaIdentity(identity), true);

const oromo = resolveEthiopiaIdentity({ organization: { country: 'ET' }, config: { lang: 'om', currencyCode: 'ETB' } });
assert.equal(oromo.language, 'om');
assert.equal(oromo.currency, 'ETB');
assert.equal(oromo.timezone, 'Africa/Addis_Ababa');

const englishFallback = resolveEthiopiaIdentity({ organization: { country: 'Ethiopia', currency: 'ETB' }, config: { lang: 'fr' } });
assert.equal(englishFallback.language, 'en');
assert.equal(englishFallback.timezone, 'Africa/Addis_Ababa');

const explicitCurrency = resolveEthiopiaIdentity({ organization: { country: 'Ethiopia', currency: 'CUSTOM', timezone: 'Africa/Addis_Ababa' }, config: { lang: 'en', currencyCode: 'ETB' } });
assert.equal(explicitCurrency.currency, 'CUSTOM');

const nonEthiopia = resolveEthiopiaIdentity({ organization: { country: 'Kenya', currency: 'KES', timezone: 'Africa/Nairobi' }, config: { lang: 'sw' } });
assert.equal(nonEthiopia.active, false);
assert.equal(nonEthiopia.countryCode, '');
assert.equal(nonEthiopia.currency, 'KES');
assert.equal(isEthiopiaIdentity(nonEthiopia), false);

assert.equal(ETHIOPIA_COUNTRY_IDENTITY_CONTRACT.canonicalCountryAuthority, 'organization.country');
assert.equal(ETHIOPIA_COUNTRY_IDENTITY_CONTRACT.canonicalCurrencyAuthority, 'organization.currency');
assert.equal(ETHIOPIA_COUNTRY_IDENTITY_CONTRACT.i18nAuthority, 'app/src/i18n/translations.js');
assert.equal(ETHIOPIA_COUNTRY_IDENTITY_CONTRACT.persistence, 'none');
assert.equal(ETHIOPIA_COUNTRY_IDENTITY_CONTRACT.ownsIdentity, false);

const source = await readFile(new URL('../app/src/ethiopia-country-identity.js', import.meta.url), 'utf8');
const digest = createHash('sha256').update(source).digest('hex');
assert.match(digest, /^[0-9a-f]{64}$/);

console.log('Phase 14.2 Ethiopia Pack Identity / Locale Regression: PASS');
console.log('Canonical organization identity preserved: PASS');
console.log('Ethiopia ETB / Addis Ababa identity projection: PASS');
console.log('Existing en/am/om i18n boundary preserved: PASS');
console.log('Timezone remains fallback-only: PASS');
console.log('No country persistence / duplicate identity authority: BLOCKED');
console.log(`Identity module SHA-256: ${digest}`);
