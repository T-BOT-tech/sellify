// Phase 15.10 — other strategic African market contract.
// Strategy-only composition boundary for African markets that are not yet
// represented by an active country overlay or regional cluster.
// This contract never becomes a commerce, inventory, payment, identity,
// authorization, audit, tax, invoice, persistence, or event authority.

export const STRATEGIC_MARKET_CONTRACT_VERSION = '1.0';

export const STRATEGIC_MARKET_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence',
  'commerce',
  'inventory',
  'payments',
  'identity',
  'authorization',
  'audit',
  'events',
  'taxLedger',
  'invoiceAuthority'
]);

const COUNTRY_CODE = /^[A-Z]{2}$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const LANGUAGE_CODE = /^[a-z]{2,3}$/;

const GHANA = Object.freeze({
  countryCode: 'GH',
  name: 'Ghana',
  tier: 1,
  marketClass: 'standalone_african_market',
  currency: 'GHS',
  languageSignals: Object.freeze(['en']),
  regionalRelationship: 'afcfta_continental_context',
  activationStatus: 'candidate_only',
  countryOverlayRequired: true
});

const ZAMBIA = Object.freeze({
  countryCode: 'ZM',
  name: 'Zambia',
  tier: 2,
  marketClass: 'standalone_african_market',
  currency: 'ZMW',
  languageSignals: Object.freeze(['en']),
  regionalRelationship: 'afcfta_continental_context',
  activationStatus: 'candidate_only',
  countryOverlayRequired: true
});

const MARKETS = Object.freeze({ gh: GHANA, zm: ZAMBIA });
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function listStrategicAfricanMarkets() {
  return Object.keys(MARKETS);
}

export function getStrategicAfricanMarket(countryCode) {
  const key = String(countryCode || '').trim().toLowerCase();
  const market = MARKETS[key];
  if (!market) {
    throw Object.assign(new Error(`Unknown strategic African market: ${countryCode}`), {
      code: 'STRATEGIC_MARKET_UNKNOWN'
    });
  }
  return market;
}

export function validateStrategicAfricanMarket(market) {
  const errors = [];
  if (!market || typeof market !== 'object' || Array.isArray(market)) {
    return { valid: false, errors: ['market must be an object'] };
  }

  for (const field of [
    'countryCode',
    'name',
    'tier',
    'marketClass',
    'currency',
    'languageSignals',
    'regionalRelationship',
    'activationStatus',
    'countryOverlayRequired'
  ]) {
    if (!hasOwn(market, field)) errors.push(`missing:${field}`);
  }

  if (!COUNTRY_CODE.test(market.countryCode || '')) errors.push('countryCode must use ISO-like alpha-2 shape');
  if (typeof market.name !== 'string' || !market.name.trim()) errors.push('name must be non-empty');
  if (!Number.isInteger(market.tier) || market.tier < 1 || market.tier > 3) errors.push('tier must be an integer from 1 to 3');
  if (market.marketClass !== 'standalone_african_market') errors.push('marketClass must be standalone_african_market');
  if (!CURRENCY_CODE.test(market.currency || '')) errors.push('currency must use ISO-like alpha-3 shape');

  if (!Array.isArray(market.languageSignals) || market.languageSignals.length === 0) {
    errors.push('languageSignals must be non-empty');
  } else if (market.languageSignals.some((code) => !LANGUAGE_CODE.test(code))) {
    errors.push('languageSignals must use lowercase ISO-like language codes');
  }

  if (market.regionalRelationship !== 'afcfta_continental_context') {
    errors.push('regionalRelationship must remain afcfta_continental_context');
  }
  if (market.activationStatus !== 'candidate_only') errors.push('activationStatus must be candidate_only');
  if (market.countryOverlayRequired !== true) errors.push('countryOverlayRequired must be true');

  for (const authority of STRATEGIC_MARKET_FORBIDDEN_AUTHORITIES) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (hasOwn(market, property)) errors.push(`forbidden:${property}`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertStrategicAfricanMarket(market) {
  const validation = validateStrategicAfricanMarket(market);
  if (!validation.valid) {
    const error = new Error(`Invalid strategic African market: ${validation.errors.join(', ')}`);
    error.code = 'STRATEGIC_MARKET_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return market;
}

export function strategicAfricanMarketContract() {
  return Object.freeze({
    version: STRATEGIC_MARKET_CONTRACT_VERSION,
    authority: 'strategic_market_contract',
    persistence: 'none',
    activation: 'manual_country_overlay_gate',
    countryOverlayRequired: true,
    regionalContext: 'AfCFTA is contextual only; regional and country authorities remain distinct',
    ownsCoreCommerce: false,
    ownsInventory: false,
    ownsPayments: false,
    ownsIdentity: false,
    ownsAuthorization: false,
    ownsAudit: false,
    ownsEvents: false,
    ownsTaxLedger: false,
    ownsInvoiceAuthority: false,
    implementationStatus: 'contract_only'
  });
}
