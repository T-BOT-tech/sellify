// Phase 15.16 — Compliance expansion contract.
// Declarative compliance composition only. Country/regional compliance signals
// never create a second compliance, audit, identity, authorization, ledger,
// persistence, retention, or regulatory-rules authority.

export const COMPLIANCE_EXPANSION_CONTRACT_VERSION = '1.0';

export const COMPLIANCE_EXPANSION_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence',
  'complianceStore',
  'audit',
  'retentionStore',
  'identity',
  'authorization',
  'taxLedger',
  'paymentLedger',
  'invoiceAuthority',
  'regulatoryRules',
  'sanctionsStore',
  'amlEngine',
  'kycEngine',
  'beneficialOwnershipStore',
  'events'
]);

const COUNTRY_CODE = /^[A-Z]{2}$/;
const REGION_CODE = /^[A-Z0-9_-]{2,12}$/;

const ACTIVE_COUNTRIES = Object.freeze({
  ET: Object.freeze({ countryCode: 'ET', scope: 'country_overlay', status: 'active_country_pack' }),
  KE: Object.freeze({ countryCode: 'KE', scope: 'country_overlay', status: 'active_country_pack' }),
  TZ: Object.freeze({ countryCode: 'TZ', scope: 'country_overlay', status: 'active_country_pack' }),
  NG: Object.freeze({ countryCode: 'NG', scope: 'country_overlay', status: 'active_country_pack' })
});

const CANDIDATE_COUNTRIES = Object.freeze({
  GH: Object.freeze({ countryCode: 'GH', scope: 'country_candidate', status: 'strategic_candidate' }),
  ZM: Object.freeze({ countryCode: 'ZM', scope: 'country_candidate', status: 'strategic_candidate' })
});

const REGIONAL_PROFILES = Object.freeze({
  EAC: Object.freeze({ regionCode: 'EAC', scope: 'regional_signal_plus_country_overlay', status: 'regional_contract_only' }),
  WAEMU: Object.freeze({ regionCode: 'WAEMU', scope: 'regional_signal_plus_country_overlay', status: 'regional_contract_only' }),
  CEMAC: Object.freeze({ regionCode: 'CEMAC', scope: 'regional_signal_plus_country_overlay', status: 'regional_contract_only' })
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function listComplianceExpansionCountries() {
  return Object.keys(ACTIVE_COUNTRIES);
}

export function listComplianceExpansionCandidates() {
  return Object.keys(CANDIDATE_COUNTRIES);
}

export function listComplianceExpansionRegions() {
  return Object.keys(REGIONAL_PROFILES);
}

export function getComplianceExpansionCountry(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  const profile = ACTIVE_COUNTRIES[code] || CANDIDATE_COUNTRIES[code];
  if (!profile) throw Object.assign(new Error(`Unknown compliance country: ${countryCode}`), { code: 'COMPLIANCE_COUNTRY_UNKNOWN' });
  return profile;
}

export function getComplianceExpansionRegion(regionCode) {
  const code = String(regionCode || '').trim().toUpperCase();
  const profile = REGIONAL_PROFILES[code];
  if (!profile) throw Object.assign(new Error(`Unknown compliance region: ${regionCode}`), { code: 'COMPLIANCE_REGION_UNKNOWN' });
  return profile;
}

export function validateComplianceExpansionProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { valid: false, errors: ['profile must be an object'] };
  if (profile.countryCode !== undefined && !COUNTRY_CODE.test(profile.countryCode || '')) errors.push('countryCode must use ISO-like alpha-2 shape');
  if (profile.regionCode !== undefined && !REGION_CODE.test(profile.regionCode || '')) errors.push('regionCode must use stable regional shape');
  if (typeof profile.scope !== 'string' || !profile.scope) errors.push('scope must be non-empty');
  if (typeof profile.status !== 'string' || !profile.status) errors.push('status must be non-empty');
  for (const authority of COMPLIANCE_EXPANSION_FORBIDDEN_AUTHORITIES) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (hasOwn(profile, property)) errors.push(`forbidden:${property}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertComplianceExpansionProfile(profile) {
  const validation = validateComplianceExpansionProfile(profile);
  if (!validation.valid) {
    const error = new Error(`Invalid compliance expansion profile: ${validation.errors.join(', ')}`);
    error.code = 'COMPLIANCE_PROFILE_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return profile;
}

export function complianceExpansionContract() {
  return Object.freeze({
    version: COMPLIANCE_EXPANSION_CONTRACT_VERSION,
    authority: 'compliance_expansion_boundary',
    existingComplianceAuthority: 'app/src/country-compliance-boundary.js + existing Core compliance/audit implementation',
    auditAuthority: 'existing audit_events / Core audit boundary',
    retentionAuthority: 'existing audit_retention_policies / Core compliance API',
    requestAuthority: 'existing compliance_requests / Core compliance API',
    exportAuthority: 'existing Core compliance export capability',
    regulatoryRuleAuthority: 'country_or_regional_authority_defined_deferred',
    globalContext: 'risk_based_compliance_standards_are contextual guidance only; no rules are encoded here',
    complianceSignals: Object.freeze([
      'audit_history',
      'retention_policy',
      'access_request',
      'export_request',
      'deletion_request',
      'aml_cdd_context',
      'beneficial_ownership_context',
      'sanctions_screening_context',
      'anti_corruption_context'
    ]),
    countryOverlayRequired: true,
    regionalExecution: 'existing_core_compliance_authority_only',
    persistence: 'none',
    ownsComplianceStore: false,
    ownsAuditStore: false,
    ownsRetentionPolicyStore: false,
    ownsComplianceRequests: false,
    ownsComplianceExport: false,
    ownsRegulatoryRules: false,
    ownsSanctionsStore: false,
    ownsAmlEngine: false,
    ownsKycEngine: false,
    ownsBeneficialOwnershipStore: false,
    implementationStatus: 'boundary_only'
  });
}
