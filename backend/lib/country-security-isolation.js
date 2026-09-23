// Phase 14.10 — country security / isolation boundary.
// Country context is subordinate to the existing tenant, organization,
// location, and authorization authorities. This module is policy composition
// only; it introduces no country security store or permission authority.

import { AUTHZ, authorize } from './authorization.js';
import { TENANT_SCOPE, tenantScopeDecision } from './tenant-isolation.js';

export const COUNTRY_SECURITY = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
});

function normaliseCountry(value) {
  const country = String(value ?? '').trim().toLowerCase();
  if (country === 'ethiopia' || country === 'ethiopia federal democratic republic') return 'ET';
  if (country === 'et') return 'ET';
  return country ? country.toUpperCase() : '';
}

function organizationCountry(organization) {
  return normaliseCountry(organization?.country);
}

/**
 * Country scope is valid only after the canonical tenant/organization scope
 * has passed. A missing country on either side fails closed when a country
 * scope is requested; no country-specific authorization is invented.
 */
export function countryScopeDecision(session, tenant, organization, countryCode, location = null) {
  if (tenantScopeDecision(session, tenant, location) !== TENANT_SCOPE.ALLOW) {
    return COUNTRY_SECURITY.DENY;
  }

  const requested = normaliseCountry(countryCode);
  const actual = organizationCountry(organization);
  if (!requested || !actual || requested !== actual) return COUNTRY_SECURITY.DENY;

  return COUNTRY_SECURITY.ALLOW;
}

export function authorizeCountryAction(session, tenant, organization, location, countryCode, resource, action) {
  if (countryScopeDecision(session, tenant, organization, countryCode, location) !== COUNTRY_SECURITY.ALLOW) {
    return AUTHZ.DENY;
  }
  return authorize(session, organization, location, resource, action);
}

export function countrySecurityIsolationContract() {
  return Object.freeze({
    country_scope_authority: 'existing organization.country',
    tenant_scope_authority: 'backend/lib/tenant-isolation.js',
    authorization_authority: 'backend/lib/authorization.js',
    location_scope_authority: 'backend/lib/tenant-isolation.js',
    persistence: 'none',
    country_permission_store: false,
    country_membership_store: false,
    country_session_authority: false,
  });
}
