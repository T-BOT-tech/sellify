import assert from 'node:assert/strict';
globalThis.window = { __APP_CONFIG__: {} };
const { resolveCountryConfiguration, countryConfigurationContract } = await import('../app/src/country-configuration.js');

const config = resolveCountryConfiguration({
  organization: { country: 'Ethiopia', currency: 'ETB', timezone: 'Africa/Addis_Ababa' },
  config: { lang: 'am' }
});
assert.equal(config.active, true);
assert.equal(config.countryCode, 'ET');
assert.equal(config.configuration.currency, 'ETB');
assert.equal(config.configuration.locale, 'am');
assert.equal(config.configuration.timezone, 'Africa/Addis_Ababa');
assert.deepEqual(config.configuration.languages, ['en', 'am', 'om']);
assert.equal(config.configuration.money.currencyCode, 'ETB');
assert.equal(config.configuration.tax.countryCode, 'ET');
assert.equal(config.configuration.documents.countryCode, 'ET');
assert.equal(config.configuration.phoneAddress.countryCode, 'ET');
assert.equal(config.configuration.payments.countryCode, 'ET');
assert.equal(config.configuration.compliance.countryCode, 'ET');
assert.equal(config.pack.countryCode, 'ET');

const noCountry = resolveCountryConfiguration({ organization: null, config: { lang: 'en' } });
assert.equal(noCountry.active, false);
assert.equal(noCountry.configuration, null);

assert.equal(countryConfigurationContract().phase, '14.9');
assert.equal(countryConfigurationContract().persistence, 'none');
assert.equal(countryConfigurationContract().ownsCountryState, false);
assert.equal(countryConfigurationContract().ownsApplicationConfig, false);
assert.equal(countryConfigurationContract().mutation, 'none');

console.log('Phase 14.9 Country Configuration Regression: PASS');
