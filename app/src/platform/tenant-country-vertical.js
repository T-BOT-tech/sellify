// Phase 16.9 — Tenant / Country / Vertical Composition Boundary.
// Composition only: combines existing tenant, country and vertical projections.
// It owns no identity, authorization, persistence, payment, commerce, inventory,
// invoice, audit, event, or transaction authority.

import { getCountryPack } from '../country-pack-contract.js';
import { resolveCountryConfiguration } from '../country-configuration.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { countrySecurityExpansionStatus } from '../../../backend/lib/country-security-expansion.js';

export const PLATFORM_COMPOSITION_VERSION = '1.0';
const VERTICALS = Object.freeze(['agriculture', 'restaurant', 'warehouse', 'logistics']);
const ACTIVE_COUNTRY_STATUS = 'active_country_pack';

function fail(message, code = 'PLATFORM_COMPOSITION_INVALID') {
  const error = new Error(`Invalid platform composition: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeCountry(value) {
  const raw = text(value, 'countryCode').toLowerCase();
  const aliases = { ethiopia: 'ET', kenya: 'KE', tanzania: 'TZ', nigeria: 'NG' };
  return aliases[raw] || raw.toUpperCase();
}

function normalizeVerticals(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail('verticalPacks must be an array');
  const ids = value.map((item) => text(item, 'verticalPacks item').toLowerCase());
  if (new Set(ids).size !== ids.length) fail('verticalPacks must not contain duplicates');
  for (const id of ids) if (!VERTICALS.includes(id)) fail(`unknown vertical pack: ${id}`, 'PLATFORM_COMPOSITION_VERTICAL_UNKNOWN');
  return ids;
}

function requireTenant(tenant) {
  if (!tenant || typeof tenant !== 'object' || Array.isArray(tenant)) fail('tenant must be an object');
  const tenantId = tenant.id ?? tenant.tenantId;
  if (typeof tenantId !== 'string' || !tenantId.trim()) fail('tenant.id or tenant.tenantId is required', 'PLATFORM_COMPOSITION_TENANT_REQUIRED');
  return tenantId.trim();
}

export function resolvePlatformTenantCountryVerticalComposition({
  tenant,
  countryCode,
  config = {},
  organization = null,
  organizationConfig = null,
  locationConfig = null,
  verticalPacks = [],
  verticalOverrides = {},
  locationId = null,
} = {}) {
  const tenantId = requireTenant(tenant);
  const code = normalizeCountry(countryCode);
  const status = countrySecurityExpansionStatus(code);
  if (status !== ACTIVE_COUNTRY_STATUS) {
    fail(`country ${code} is not an active country pack`, 'PLATFORM_COMPOSITION_COUNTRY_INACTIVE');
  }
  const pack = getCountryPack(code);
  const country = resolveCountryConfiguration({ organization: organization ?? { country: code }, config, timezone: organization?.timezone ?? '' });
  const ids = normalizeVerticals(verticalPacks);
  const vertical = ids.map((packId) => getVerticalPackConfiguration({
    packId,
    config,
    organizationConfig,
    locationConfig,
    overrides: verticalOverrides?.[packId] ?? null,
    organizationId: tenant.organizationId ?? organization?.id ?? null,
    locationId,
  }));

  return Object.freeze({
    version: PLATFORM_COMPOSITION_VERSION,
    tenant: Object.freeze({ id: tenantId, organizationId: tenant.organizationId ?? organization?.id ?? null, locationId }),
    country: Object.freeze({ code, status, pack, configuration: country.configuration }),
    verticals: Object.freeze(vertical),
    authorities: Object.freeze({
      tenant: 'existing tenant/location isolation authority',
      country: 'existing country pack/configuration projections',
      vertical: 'existing vertical configuration + central authorization',
    }),
    persistence: 'none',
    mutation: 'none',
    authorization: 'existing_authorization_only',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
    duplicateAuthority: false,
    failClosed: true,
  });
}

export function platformTenantCountryVerticalCompositionContract() {
  return Object.freeze({
    version: PLATFORM_COMPOSITION_VERSION,
    verticals: [...VERTICALS],
    countryActivation: 'active_country_pack_only',
    candidateCountries: 'fail_closed_until_country_pack_activation',
    regionalCountries: 'fail_closed_until_country_overlay_activation',
    tenantAuthority: 'existing_tenant_and_location_isolation',
    countryAuthority: 'existing_country_pack_and_configuration_projections',
    verticalAuthority: 'existing_vertical_configuration_and_central_authorization',
    persistence: 'none',
    mutation: 'none',
    authorization: 'existing_authorization_only',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
    duplicateAuthority: false,
    failClosed: true,
  });
}

export function assertPlatformTenantCountryVerticalBoundary() {
  const contract = platformTenantCountryVerticalCompositionContract();
  if (contract.persistence !== 'none' || contract.mutation !== 'none' || contract.duplicateAuthority) {
    fail('composition boundary cannot own or mutate platform authority');
  }
  return contract;
}
