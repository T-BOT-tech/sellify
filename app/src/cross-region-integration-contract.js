// Phase 15.19 — Cross-Region Integration Contract.
// Composition-only routing metadata. Cross-region integration never creates a
// regional transaction, payment, inventory, tax, identity, event, or ledger
// authority. Country overlays and existing Core authorities remain canonical.
import { getCountryPack } from './country-pack-contract.js';
import { getRegionalCluster, listRegionalClusters } from './regional-cluster-contract.js';

export const CROSS_REGION_INTEGRATION_VERSION = '1.0';

export const CROSS_REGION_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence', 'commerce', 'inventory', 'payments', 'identity',
  'authorization', 'audit', 'events', 'taxLedger', 'invoiceAuthority',
  'regionalTransaction', 'regionalLedger', 'crossRegionSettlement',
]);

const ACTIVE_COUNTRIES = Object.freeze(new Set(['ET', 'KE', 'TZ', 'NG']));
const CANDIDATE_COUNTRIES = Object.freeze(new Set(['GH', 'ZM']));

const normalise = (value) => String(value ?? '').trim().toUpperCase();

function countryInCluster(code, cluster) {
  return cluster.countries.includes(code);
}

export function crossRegionCountryStatus(countryCode) {
  const code = normalise(countryCode);
  if (ACTIVE_COUNTRIES.has(code)) return 'active_country_pack';
  if (CANDIDATE_COUNTRIES.has(code)) return 'strategic_candidate';
  for (const regionCode of listRegionalClusters()) {
    const cluster = getRegionalCluster(regionCode);
    if (countryInCluster(code, cluster)) return 'regional_country_boundary_only';
  }
  return 'unknown';
}

export function regionsForCountry(countryCode) {
  const code = normalise(countryCode);
  return listRegionalClusters().filter((regionCode) => countryInCluster(code, getRegionalCluster(regionCode)));
}

export function resolveCrossRegionBoundary({ fromCountry, toCountry } = {}) {
  const from = normalise(fromCountry);
  const to = normalise(toCountry);
  if (!from || !to) {
    const error = new Error('Both fromCountry and toCountry are required');
    error.code = 'CROSS_REGION_COUNTRY_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const fromStatus = crossRegionCountryStatus(from);
  const toStatus = crossRegionCountryStatus(to);
  if (fromStatus === 'unknown' || toStatus === 'unknown') {
    const error = new Error(`Unknown country boundary: ${from || fromCountry} → ${to || toCountry}`);
    error.code = 'CROSS_REGION_COUNTRY_UNKNOWN';
    error.statusCode = 400;
    throw error;
  }
  if (fromStatus !== 'active_country_pack' || toStatus !== 'active_country_pack') {
    const error = new Error(`Cross-region integration requires active country packs: ${from} → ${to}`);
    error.code = 'CROSS_REGION_COUNTRY_INACTIVE';
    error.statusCode = 400;
    throw error;
  }

  // Validate that both active countries still resolve through the canonical
  // country-pack authority. No regional state is created here.
  const fromPack = getCountryPack(from);
  const toPack = getCountryPack(to);
  const fromRegions = regionsForCountry(from);
  const toRegions = regionsForCountry(to);

  return Object.freeze({
    fromCountry: fromPack.countryCode,
    toCountry: toPack.countryCode,
    fromRegions: Object.freeze(fromRegions),
    toRegions: Object.freeze(toRegions),
    sameRegion: fromRegions.some((region) => toRegions.includes(region)),
    integrationMode: 'country_overlay_plus_existing_core_capability',
    regionalExecution: 'none',
    settlement: 'existing_payment_authority_only',
    tax: 'country_overlay_only',
    events: 'existing_versioned_event_and_outbox_only',
    persistence: 'none',
    activation: 'manual_country_pack_activation_required',
  });
}

export function crossRegionIntegrationContract() {
  return Object.freeze({
    version: CROSS_REGION_INTEGRATION_VERSION,
    authority: 'cross_region_integration_boundary',
    regionalDiscovery: 'app/src/regional-cluster-contract.js',
    countryAuthority: 'app/src/country-pack-contract.js',
    integrationFlow: 'Country Overlay → Existing Core Capability → External Adapter when required',
    activeCountries: [...ACTIVE_COUNTRIES],
    candidateCountries: [...CANDIDATE_COUNTRIES],
    regionalExecution: 'none',
    countryOverlayRequired: true,
    paymentSettlement: 'existing_payment_authority_only',
    taxExecution: 'country_overlay_only',
    documentExecution: 'existing_invoice_authority_only',
    eventExecution: 'existing_versioned_event_and_outbox_only',
    persistence: 'none',
    ownsRegionalTransaction: false,
    ownsRegionalLedger: false,
    ownsCrossRegionSettlement: false,
    ownsCommerce: false,
    ownsInventory: false,
    ownsPayments: false,
    ownsIdentity: false,
    ownsAuthorization: false,
    ownsAudit: false,
    ownsEvents: false,
    ownsTaxLedger: false,
    ownsInvoiceAuthority: false,
    failClosed: true,
    implementationStatus: 'boundary_only',
  });
}
