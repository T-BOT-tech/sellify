// Phase 20.3 — Cross-Border Market Context composition.
// Composes the existing Phase 19 discovery market-context contract for origin
// and destination markets. It owns no country, currency, pricing, inventory,
// FX, commerce, payment, or geography authority and remains persistence-free.

import { normalizeDiscoveryMarketContext, discoveryMarketContextContract } from '../../backend/lib/discovery/market-context.js';
import { getCountryPack } from './country-pack-contract.js';
import { buildTradeLane } from './cross-border-contract.js';

export const CROSS_BORDER_MARKET_CONTEXT_VERSION = '1.0';

const cleanCountry = (value, field) => {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw Object.assign(new TypeError(`${field} must use ISO-like alpha-2 country shape`), { code: 'CROSS_BORDER_MARKET_CONTEXT_INVALID' });
  return code;
};

const contextFor = (input = {}, field) => {
  const countryCode = cleanCountry(input.countryCode ?? input.country, field);
  const context = normalizeDiscoveryMarketContext({ ...input, countryCode });
  return Object.freeze(context);
};

export function buildCrossBorderMarketContext({ origin = {}, destination = {}, tradeLane = null, provenance = null } = {}) {
  const originContext = contextFor(origin, 'origin.countryCode');
  const destinationContext = contextFor(destination, 'destination.countryCode');
  if (originContext.countryCode === destinationContext.countryCode) {
    throw Object.assign(new Error('Cross-border market context must cross country boundaries'), { code: 'CROSS_BORDER_SAME_COUNTRY' });
  }

  const originPack = getCountryPack(originContext.countryCode);
  const destinationPack = getCountryPack(destinationContext.countryCode);
  const lane = tradeLane || buildTradeLane({ origin: originContext.countryCode, destination: destinationContext.countryCode, provenance });

  if (lane.origin !== originContext.countryCode || lane.destination !== destinationContext.countryCode) {
    throw Object.assign(new Error('tradeLane does not match market context countries'), { code: 'CROSS_BORDER_TRADE_LANE_MISMATCH' });
  }

  return Object.freeze({
    contractVersion: CROSS_BORDER_MARKET_CONTEXT_VERSION,
    origin: originContext,
    destination: destinationContext,
    countryReferences: Object.freeze({
      origin: originPack.countryCode,
      destination: destinationPack.countryCode,
    }),
    tradeLaneReference: Object.freeze({ origin: lane.origin, destination: lane.destination, type: 'trade_lane' }),
    currencyContext: Object.freeze({
      originCurrency: originContext.currency || originPack.currency,
      destinationCurrency: destinationContext.currency || destinationPack.currency,
    }),
    commercialContext: Object.freeze({
      originCommercialMode: originContext.commercialMode,
      destinationCommercialMode: destinationContext.commercialMode,
      quantity: originContext.quantity ?? destinationContext.quantity ?? null,
      unit: originContext.unit ?? destinationContext.unit ?? null,
    }),
    provenance: provenance == null ? null : Object.freeze({ ...provenance }),
    persistent: false,
    authoritative: false,
    mutates: false,
    discoveryAuthority: discoveryMarketContextContract().authority,
    countryAuthority: 'country_pack_contract',
    currencyAuthority: 'currency_metadata_contract',
    pricingAuthority: 'source_domain',
    exchangeRateAuthority: 'external_adapter_only',
  });
}

export function crossBorderMarketContextContract() {
  return Object.freeze({
    version: CROSS_BORDER_MARKET_CONTEXT_VERSION,
    authority: 'cross_border_market_context_composition',
    persistence: 'none',
    mutation: 'none',
    sourceAuthority: 'existing_discovery_market_context',
    countryAuthority: 'country_pack_contract',
    currencyAuthority: 'currency_metadata_contract',
    pricingAuthority: 'source_domain',
    exchangeRateAuthority: 'external_adapter_only',
    tradeLaneAuthority: 'cross_border_trade_lane_composition',
    createsOrder: false,
    mutatesInventory: false,
    mutatesPayment: false,
    executesProviders: false,
  });
}
