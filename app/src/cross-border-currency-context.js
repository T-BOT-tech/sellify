// Phase 20.5 — Cross-Border Currency / FX Context.
// Composition-only bridge over the existing country money and currency
// metadata authorities. FX is an observation/reference boundary only; this
// module owns no exchange-rate source, ledger, payment, settlement, or
// persistence authority.

import { getCountryPack } from './country-pack-contract.js';
import { getCurrencyMetadata } from './currency-money-contract.js';
import { crossBorderContract } from './cross-border-contract.js';

export const CROSS_BORDER_CURRENCY_CONTEXT_VERSION = '1.0';

export const CROSS_BORDER_FX_STATES = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  OBSERVED: 'observed',
  STALE: 'stale',
  UNKNOWN: 'unknown',
});

export const CROSS_BORDER_CURRENCY_CONTEXT = Object.freeze({
  version: CROSS_BORDER_CURRENCY_CONTEXT_VERSION,
  authority: 'existing_currency_money_authority_plus_external_fx_adapter',
  persistence: 'none',
  mutation: 'none',
  ownsExchangeRates: false,
  ownsMoneyLedger: false,
  ownsSettlement: false,
  ownsPaymentState: false,
  calculatesTax: false,
  providerExecution: 'external_fx_provider_via_existing_adapter_boundary',
  storage: 'none',
});

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) throw Object.assign(new TypeError(`${field} must be a non-empty string`), {
    code: 'CROSS_BORDER_CURRENCY_INVALID',
  });
  return result;
};

const currency = (value, field) => {
  const code = text(value, field).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw Object.assign(new TypeError(`${field} must use ISO-4217 currency shape`), {
      code: 'CROSS_BORDER_CURRENCY_CODE_INVALID',
    });
  }
  return code;
};

const optionalReference = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object or null`);
  }
  return Object.freeze({ ...value });
};

function countryCurrencyView(countryCode, field) {
  const pack = getCountryPack(countryCode);
  const metadata = getCurrencyMetadata(pack.currency);
  return Object.freeze({
    countryCode: pack.countryCode,
    currencyCode: pack.currency,
    symbol: metadata.symbol,
    decimalPlaces: metadata.decimalPlaces,
    moneyAuthority: 'app/src/utils/money.js',
    metadataAuthority: 'app/src/currency-money-contract.js',
    sourceField: field,
  });
}

export function buildCurrencyContext({
  transactionCurrency,
  settlementCurrency = null,
  displayCurrency = null,
  fxReference = null,
  fxState = CROSS_BORDER_FX_STATES.NOT_REQUESTED,
  provenance = null,
} = {}) {
  const transaction = currency(transactionCurrency, 'transactionCurrency');
  const settlement = settlementCurrency == null ? transaction : currency(settlementCurrency, 'settlementCurrency');
  const display = displayCurrency == null ? transaction : currency(displayCurrency, 'displayCurrency');

  // Validate all referenced currencies against the existing metadata authority.
  getCurrencyMetadata(transaction);
  getCurrencyMetadata(settlement);
  getCurrencyMetadata(display);

  if (!Object.values(CROSS_BORDER_FX_STATES).includes(fxState)) {
    throw new TypeError(`Unsupported fxState: ${fxState}`);
  }
  if (fxState === CROSS_BORDER_FX_STATES.OBSERVED && !fxReference) {
    throw new TypeError('observed FX state requires an fxReference');
  }

  return Object.freeze({
    contractVersion: CROSS_BORDER_CURRENCY_CONTEXT_VERSION,
    transactionCurrency: transaction,
    settlementCurrency: settlement,
    displayCurrency: display,
    fxState,
    fxReference: optionalReference(fxReference, 'fxReference'),
    provenance: optionalReference(provenance, 'provenance'),
    persistent: false,
    authoritative: false,
    ownsExchangeRates: false,
    ownsMoneyLedger: false,
    ownsSettlement: false,
  });
}

export function resolveCrossBorderCurrencyContext({
  origin,
  destination,
  transactionCurrency = null,
  settlementCurrency = null,
  displayCurrency = null,
  fxReference = null,
  fxState = CROSS_BORDER_FX_STATES.NOT_REQUESTED,
  provenance = null,
} = {}) {
  const originView = countryCurrencyView(origin, 'originCountryPack');
  const destinationView = countryCurrencyView(destination, 'destinationCountryPack');
  if (originView.countryCode === destinationView.countryCode) {
    throw Object.assign(new Error('Cross-border currency context requires different countries'), {
      code: 'CROSS_BORDER_SAME_COUNTRY',
    });
  }

  const constitution = crossBorderContract();
  if (constitution.persistence !== 'none' || constitution.duplicateAuthority) {
    throw new Error('Invalid cross-border constitution for currency context');
  }

  const context = buildCurrencyContext({
    transactionCurrency: transactionCurrency || originView.currencyCode,
    settlementCurrency,
    displayCurrency,
    fxReference,
    fxState,
    provenance,
  });

  return Object.freeze({
    contractVersion: CROSS_BORDER_CURRENCY_CONTEXT_VERSION,
    origin: originView,
    destination: destinationView,
    ...context,
    currencyAuthority: 'existing_country_money_and_currency_metadata_authority',
    fxAuthority: 'external_provider_via_adapter_only',
  });
}

export function assertCrossBorderCurrencyContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('currency context must be an object');
  }
  if (value.persistent !== false || value.authoritative !== false) {
    throw new Error('Cross-border currency context must remain derived and non-persistent');
  }
  if (value.ownsExchangeRates || value.ownsMoneyLedger || value.ownsSettlement) {
    throw new Error('Cross-border currency context cannot own financial authority');
  }
  if (value.fxState === CROSS_BORDER_FX_STATES.OBSERVED && !value.fxReference) {
    throw new Error('Observed FX state requires provenance-bearing reference');
  }
  if (value.fxState === CROSS_BORDER_FX_STATES.UNKNOWN && value.fxReference?.result === 'success') {
    throw new Error('Unknown FX state cannot be represented as successful');
  }
  return true;
}
