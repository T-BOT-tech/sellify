// Phase 14.4 — country tax boundary.
// Declarative boundary only. Tax rules/calculation/persistence remain outside
// this bridge until a separately approved implementation is introduced.

import { getCountryPack } from './country-pack-contract.js';
import { resolveEthiopiaIdentity } from './ethiopia-country-identity.js';

export function resolveCountryTaxBoundary(countryCode = 'ET') {
  const pack = getCountryPack(countryCode);
  return Object.freeze({
    countryCode: pack.countryCode,
    mode: pack.tax.mode,
    implementation: pack.tax.implementation,
    taxAuthority: 'country_tax_boundary',
    calculationAuthority: null,
    persistence: 'none',
    ownsTaxLedger: false,
    ownsInvoiceTaxState: false,
  });
}

export function resolveEthiopiaTaxBoundary({ organization = null, config = null, timezone = '' } = {}) {
  const identity = resolveEthiopiaIdentity({ organization, config, timezone });
  if (!identity.active) return Object.freeze({ active: false, boundary: null });
  return Object.freeze({ active: true, boundary: resolveCountryTaxBoundary('ET') });
}

export const COUNTRY_TAX_BOUNDARY_CONTRACT = Object.freeze({
  phase: '14.4',
  authority: 'country_tax_boundary',
  countryPackAuthority: 'app/src/country-pack-contract.js',
  implementationStatus: 'boundary_only',
  persistence: 'none',
  ownsTaxCalculation: false,
  ownsTaxLedger: false,
  ownsInvoiceState: false,
  replacesCoreCommerce: false,
  providerBoundary: 'Country Tax Boundary → Existing Core Transaction/Invoice Capability',
});
