// Phase 15.17 — country security / isolation expansion.
// Country-specific security remains a policy composition layer over canonical
// tenant, organization, location and authorization authorities.
import { AUTHZ, authorize } from './authorization.js';
import { TENANT_SCOPE, tenantScopeDecision } from './tenant-isolation.js';
import { countryScopeDecision, COUNTRY_SECURITY } from './country-security-isolation.js';

export const COUNTRY_SECURITY_EXPANSION_VERSION = '1.0';
export const COUNTRY_SECURITY_EXPANSION_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence','permissionStore','membershipStore','sessionStore','identityStore',
  'authorization','tenantStore','organizationStore','locationStore','auditStore','events'
]);

const ACTIVE_COUNTRIES = Object.freeze(new Set(['ET','KE','TZ','NG']));
const CANDIDATE_COUNTRIES = Object.freeze(new Set(['GH','ZM']));
const REGIONAL_COUNTRIES = Object.freeze(new Set([
  'BI','CD','KE','RW','SO','SS','TZ','UG',
  'BJ','BF','CI','GW','ML','NE','SN','TG',
  'CM','CF','TD','CG','GQ','GA'
]));

const normalise = (value) => {
  const code = String(value ?? '').trim().toUpperCase();
  return code;
};

export function countrySecurityExpansionStatus(countryCode) {
  const code = normalise(countryCode);
  if (ACTIVE_COUNTRIES.has(code)) return 'active_country_pack';
  if (CANDIDATE_COUNTRIES.has(code)) return 'strategic_candidate';
  if (REGIONAL_COUNTRIES.has(code)) return 'regional_country_boundary_only';
  return 'unknown';
}

export function countrySecurityExpansionDecision(session, tenant, organization, location, countryCode, resource, action) {
  const code = normalise(countryCode);
  const status = countrySecurityExpansionStatus(code);
  if (status === 'unknown' || status === 'strategic_candidate' || status === 'regional_country_boundary_only') {
    return COUNTRY_SECURITY.DENY;
  }
  return countryScopeDecision(session, tenant, organization, code, location) === COUNTRY_SECURITY.ALLOW
    ? authorize(session, organization, location, resource, action)
    : AUTHZ.DENY;
}

export function countrySecurityExpansionContract() {
  return Object.freeze({
    version: COUNTRY_SECURITY_EXPANSION_VERSION,
    authority: 'country_security_expansion_boundary',
    activeCountrySecurity: [...ACTIVE_COUNTRIES],
    candidateCountries: [...CANDIDATE_COUNTRIES],
    regionalCountryBoundaryOnly: [...REGIONAL_COUNTRIES].filter((c) => !ACTIVE_COUNTRIES.has(c)),
    canonicalTenantScope: 'backend/lib/tenant-isolation.js',
    canonicalAuthorization: 'backend/lib/authorization.js',
    canonicalCountryScope: 'backend/lib/country-security-isolation.js',
    activation: 'active_country_pack_only',
    candidateActivation: 'manual_country_pack_activation_required',
    regionalActivation: 'country_overlay_required',
    persistence: 'none',
    ownsPermissionStore: false,
    ownsMembershipStore: false,
    ownsSessionStore: false,
    ownsIdentityStore: false,
    ownsAuthorization: false,
    ownsTenantStore: false,
    ownsOrganizationStore: false,
    ownsLocationStore: false,
    ownsAuditStore: false,
    ownsEvents: false,
    failClosed: true,
    implementationStatus: 'boundary_only'
  });
}
