// Phase 14.3 — country currency / money localization bridge.
// Projects country-pack currency metadata onto the existing Core money
// authority. It does not introduce a second money representation, ledger,
// rounding policy, or currency persistence authority.

import { getCountryPack } from './country-pack-contract.js';
import { CURRENCY_SYMBOLS } from './constants.js';
import { formatMoney, toMinorUnits, fromMinorUnits } from './utils/money.js';
import { getCurrencyMetadata } from './currency-money-contract.js';



export function resolveCountryMoney(countryCode = 'ET') {
  const pack = getCountryPack(countryCode);
  const currencyCode = pack.currency;
  return Object.freeze({
    countryCode: pack.countryCode,
    currencyCode,
    symbol: CURRENCY_SYMBOLS[currencyCode] || getCurrencyMetadata(currencyCode).symbol || '',
    decimalPlaces: getCurrencyMetadata(currencyCode).decimalPlaces,
    decimalSeparator: pack.numberFormats.decimalSeparator,
    groupingSeparator: pack.numberFormats.groupingSeparator,
    moneyAuthority: 'app/src/utils/money.js',
    currencySymbolAuthority: 'app/src/constants.js',
    persistence: 'none',
  });
}

export function formatCountryMoney(minor, countryCode = 'ET') {
  const money = resolveCountryMoney(countryCode);
  return `${money.symbol}${formatMoney(minor, money.currencyCode)}`;
}

export function toCountryMinorUnits(major, countryCode = 'ET') {
  return toMinorUnits(major, resolveCountryMoney(countryCode).currencyCode);
}

export function fromCountryMinorUnits(minor, countryCode = 'ET') {
  return fromMinorUnits(minor, resolveCountryMoney(countryCode).currencyCode);
}

export const COUNTRY_MONEY_LOCALIZATION_CONTRACT = Object.freeze({
  phase: '14.3',
  authority: 'country_money_localization_bridge',
  currencyMetadataAuthority: 'country_pack_contract',
  moneyCalculationAuthority: 'app/src/utils/money.js',
  currencySymbolAuthority: 'app/src/constants.js',
  currencyMetadataAuthority: 'app/src/currency-money-contract.js',
  persistence: 'none',
  ownsMoneyLedger: false,
  ownsExchangeRates: false,
  ownsTax: false,
  migrationRequired: false,
});
