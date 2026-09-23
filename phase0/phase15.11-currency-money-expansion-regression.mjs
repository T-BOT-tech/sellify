import assert from 'node:assert/strict';

globalThis.window = globalThis.window || { __APP_CONFIG__: {} };

const { CURRENCY_SYMBOLS } = await import('../app/src/constants.js');
const { formatMoney, toMinorUnits, fromMinorUnits } = await import('../app/src/utils/money.js');
const { resolveCountryMoney } = await import('../app/src/country-money-localization.js');
const {
  CURRENCY_MONEY_CONTRACT_VERSION,
  CURRENCY_MONEY_FORBIDDEN_AUTHORITIES,
  listCurrencyMetadata,
  getCurrencyMetadata,
  validateCurrencyMetadata,
  assertCurrencyMetadata,
  currencyMoneyContract
} = await import('../app/src/currency-money-contract.js');
assert.equal(CURRENCY_MONEY_CONTRACT_VERSION, '1.0');
const expected = ['ETB','KES','TZS','NGN','GHS','ZMW','XOF','XAF','BIF','CDF','RWF','SOS','SSP','UGX'];
assert.deepEqual(listCurrencyMetadata(), expected);

for (const code of expected) {
  const metadata = getCurrencyMetadata(code);
  assert.equal(metadata.code, code);
  assert.equal(validateCurrencyMetadata(metadata).valid, true);
  assert.doesNotThrow(() => assertCurrencyMetadata(metadata));
  assert.ok(CURRENCY_SYMBOLS[code], `${code} symbol must exist`);
}

assert.equal(getCurrencyMetadata('XAF').decimalPlaces, 0);
assert.equal(getCurrencyMetadata('BIF').decimalPlaces, 0);
assert.equal(getCurrencyMetadata('RWF').decimalPlaces, 0);
assert.equal(getCurrencyMetadata('UGX').decimalPlaces, 0);
assert.equal(getCurrencyMetadata('XOF').decimalPlaces, 2);
assert.equal(getCurrencyMetadata('XOF').canonicalDecimalPlaces, 0);
assert.equal(getCurrencyMetadata('XOF').storageCompatibility, 'legacy_2_decimal_scale_preserved');

assert.equal(toMinorUnits('12.34', 'XAF'), 12);
assert.equal(fromMinorUnits(12, 'XAF'), 12);
assert.equal(formatMoney(12, 'XAF'), '12');
assert.equal(toMinorUnits('12.34', 'XOF'), 1234);
assert.equal(formatMoney(1234, 'XOF'), '12.34');

assert.equal(resolveCountryMoney('ET').currencyCode, 'ETB');
assert.equal(resolveCountryMoney('KE').currencyCode, 'KES');
assert.equal(resolveCountryMoney('TZ').currencyCode, 'TZS');
assert.equal(resolveCountryMoney('NG').currencyCode, 'NGN');
assert.equal(validateCurrencyMetadata({ ...getCurrencyMetadata('ETB'), ownsLedger: true }).valid, false);

for (const authority of CURRENCY_MONEY_FORBIDDEN_AUTHORITIES) {
  const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
  const invalid = { ...getCurrencyMetadata('ETB'), [property]: true };
  assert.equal(validateCurrencyMetadata(invalid).valid, false, `${property} must fail closed`);
}

assert.throws(() => getCurrencyMetadata('XXX'), (error) => error.code === 'CURRENCY_METADATA_UNKNOWN');
const contract = currencyMoneyContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.ownsMoneyLedger, false);
assert.equal(contract.ownsExchangeRates, false);
assert.equal(contract.ownsTax, false);
assert.equal(contract.ownsPayments, false);
assert.equal(contract.ownsInvoices, false);
assert.equal(contract.migrationRequired, false);
assert.equal(contract.exchangeRatePolicy, 'deferred_external_adapter_only');

console.log('Phase 15.11 Currency / Money Expansion Regression: PASS');
console.log('Expanded currency metadata registry: PASS');
console.log('ISO-shaped currency codes and metadata validation: PASS');
console.log('New 0-decimal currency support (XAF/BIF/RWF/UGX): PASS');
console.log('Existing XOF 2-decimal storage compatibility preserved: PASS');
console.log('Existing country money authority remains canonical: PASS');
console.log('Forbidden money authority claims fail closed: PASS');
console.log('No FX / ledger / tax / payment / invoice authority introduced: PASS');
