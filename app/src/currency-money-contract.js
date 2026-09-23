// Phase 15.11 — currency / money expansion contract.
// Declarative metadata only. Money calculation remains owned by
// app/src/utils/money.js; this registry owns no ledger, FX rate, tax, or
// persistence authority.

export const CURRENCY_MONEY_CONTRACT_VERSION = '1.0';

const CURRENCIES = Object.freeze({
  ETB: Object.freeze({ code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br ', decimalPlaces: 2, status: 'active_country_pack' }),
  KES: Object.freeze({ code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh ', decimalPlaces: 2, status: 'active_country_pack' }),
  TZS: Object.freeze({ code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh ', decimalPlaces: 2, status: 'active_country_pack' }),
  NGN: Object.freeze({ code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2, status: 'active_country_pack' }),
  GHS: Object.freeze({ code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimalPlaces: 2, status: 'strategic_candidate' }),
  ZMW: Object.freeze({ code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK ', decimalPlaces: 2, status: 'strategic_candidate' }),
  XOF: Object.freeze({ code: 'XOF', name: 'West African CFA franc', symbol: 'CFA ', decimalPlaces: 2, canonicalDecimalPlaces: 0, status: 'regional_contract', storageCompatibility: 'legacy_2_decimal_scale_preserved' }),
  XAF: Object.freeze({ code: 'XAF', name: 'Central African CFA franc', symbol: 'FCFA ', decimalPlaces: 0, status: 'regional_contract' }),
  BIF: Object.freeze({ code: 'BIF', name: 'Burundian Franc', symbol: 'FBu ', decimalPlaces: 0, status: 'regional_candidate' }),
  CDF: Object.freeze({ code: 'CDF', name: 'Congolese Franc', symbol: 'FC ', decimalPlaces: 2, status: 'regional_candidate' }),
  RWF: Object.freeze({ code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw ', decimalPlaces: 0, status: 'regional_candidate' }),
  SOS: Object.freeze({ code: 'SOS', name: 'Somali Shilling', symbol: 'Sh ', decimalPlaces: 2, status: 'regional_candidate' }),
  SSP: Object.freeze({ code: 'SSP', name: 'South Sudanese Pound', symbol: '£ ', decimalPlaces: 2, status: 'regional_candidate' }),
  UGX: Object.freeze({ code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh ', decimalPlaces: 0, status: 'regional_candidate' })
});

export const CURRENCY_MONEY_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence', 'ledger', 'exchangeRates', 'tax', 'payments', 'invoices'
]);

export function listCurrencyMetadata() { return Object.keys(CURRENCIES); }

export function getCurrencyMetadata(currencyCode) {
  const key = String(currencyCode || '').trim().toUpperCase();
  const currency = CURRENCIES[key];
  if (!currency) throw Object.assign(new Error(`Unknown currency metadata: ${currencyCode}`), { code: 'CURRENCY_METADATA_UNKNOWN' });
  return currency;
}

export function validateCurrencyMetadata(currency) {
  const errors = [];
  if (!currency || typeof currency !== 'object' || Array.isArray(currency)) return { valid: false, errors: ['currency must be an object'] };
  if (!/^[A-Z]{3}$/.test(currency.code || '')) errors.push('code must be ISO-4217 shape');
  if (!currency.name) errors.push('name required');
  if (typeof currency.symbol !== 'string') errors.push('symbol must be a string');
  if (!Number.isInteger(currency.decimalPlaces) || currency.decimalPlaces < 0 || currency.decimalPlaces > 3) errors.push('decimalPlaces must be an integer 0..3');
  if (currency.canonicalDecimalPlaces !== undefined && (!Number.isInteger(currency.canonicalDecimalPlaces) || currency.canonicalDecimalPlaces < 0 || currency.canonicalDecimalPlaces > 3)) errors.push('canonicalDecimalPlaces must be an integer 0..3');
  for (const authority of CURRENCY_MONEY_FORBIDDEN_AUTHORITIES) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(currency, property)) errors.push(`forbidden:${property}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertCurrencyMetadata(currency) {
  const validation = validateCurrencyMetadata(currency);
  if (!validation.valid) {
    const error = new Error(`Invalid currency metadata: ${validation.errors.join(', ')}`);
    error.code = 'CURRENCY_METADATA_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return currency;
}

export function currencyMoneyContract() {
  return Object.freeze({
    version: CURRENCY_MONEY_CONTRACT_VERSION,
    authority: 'currency_metadata_contract',
    calculationAuthority: 'app/src/utils/money.js',
    symbolAuthority: 'app/src/constants.js',
    persistence: 'none',
    ownsMoneyLedger: false,
    ownsExchangeRates: false,
    ownsTax: false,
    ownsPayments: false,
    ownsInvoices: false,
    migrationRequired: false,
    exchangeRatePolicy: 'deferred_external_adapter_only',
    compatibilityPolicy: 'preserve_existing_storage_scale_until_explicit_migration'
  });
}
