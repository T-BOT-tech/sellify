import assert from 'node:assert/strict';
globalThis.window = { __APP_CONFIG__: {} };

const { getCountryPack } = await import('../app/src/country-pack-contract.js');
const { resolveEthiopiaIdentity } = await import('../app/src/ethiopia-country-identity.js');
const {
  resolveCountryMoney,
  formatCountryMoney,
  toCountryMinorUnits,
  fromCountryMinorUnits,
  COUNTRY_MONEY_LOCALIZATION_CONTRACT,
} = await import('../app/src/country-money-localization.js');
const { CURRENCY_SYMBOLS } = await import('../app/src/constants.js');
const { formatMoney, toMinorUnits, fromMinorUnits } = await import('../app/src/utils/money.js');

const et = getCountryPack('ET');
const money = resolveCountryMoney('ET');
assert.equal(et.currency, 'ETB');
assert.equal(money.countryCode, 'ET');
assert.equal(money.currencyCode, 'ETB');
assert.equal(money.symbol, CURRENCY_SYMBOLS.ETB);
assert.equal(money.symbol, 'Br ');
assert.equal(money.decimalPlaces, 2);
assert.equal(money.decimalSeparator, '.');
assert.equal(money.groupingSeparator, ',');
assert.equal(toCountryMinorUnits('123.45'), 12345);
assert.equal(fromCountryMinorUnits(12345), 123.45);
assert.equal(formatCountryMoney(12345), 'Br 123.45');
assert.equal(toMinorUnits('123.45', 'ETB'), 12345);
assert.equal(fromMinorUnits(12345, 'ETB'), 123.45);
assert.equal(formatMoney(12345, 'ETB'), '123.45');

const identity = resolveEthiopiaIdentity({
  organization: { country: 'Ethiopia', currency: 'ETB', timezone: 'Africa/Addis_Ababa' },
  config: { lang: 'am', currencyCode: 'ETB' },
});
assert.equal(identity.currency, 'ETB');
assert.equal(identity.language, 'am');

assert.equal(COUNTRY_MONEY_LOCALIZATION_CONTRACT.persistence, 'none');
assert.equal(COUNTRY_MONEY_LOCALIZATION_CONTRACT.ownsMoneyLedger, false);
assert.equal(COUNTRY_MONEY_LOCALIZATION_CONTRACT.ownsExchangeRates, false);
assert.equal(COUNTRY_MONEY_LOCALIZATION_CONTRACT.ownsTax, false);
assert.equal(COUNTRY_MONEY_LOCALIZATION_CONTRACT.migrationRequired, false);

console.log('Phase 14.3 Country Currency / Money Localization Regression: PASS');
console.log('ETB currency metadata: PASS');
console.log('Existing minor-unit money authority preserved: PASS');
console.log('Existing ETB symbol authority preserved: PASS');
console.log('Ethiopia identity → ETB continuity: PASS');
console.log('No country money persistence / duplicate ledger / exchange-rate authority: BLOCKED');
