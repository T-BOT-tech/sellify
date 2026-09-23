// Phase 14.8 — Ethiopia compliance boundary.
// Declarative bridge over the existing Core compliance/audit authority. This
// module does not create country-specific compliance persistence, legal rules,
// audit storage, retention storage, or a second request/export workflow.

import { getCountryPack } from './country-pack-contract.js';
import { resolveEthiopiaIdentity } from './ethiopia-country-identity.js';
import { auditBoundaryContract } from './audit/audit-boundary.js';

const COMPLIANCE_CAPABILITIES = Object.freeze([
  'audit_history',
  'retention_policy',
  'access_request',
  'export_request',
  'deletion_request',
]);

export function resolveCountryComplianceBoundary(countryCode = 'ET') {
  const pack = getCountryPack(countryCode);
  const audit = auditBoundaryContract();
  return Object.freeze({
    countryCode: pack.countryCode,
    mode: pack.compliance.mode,
    implementation: pack.compliance.implementation,
    regulatoryRules: 'country_defined_deferred',
    capabilities: [...COMPLIANCE_CAPABILITIES],
    complianceAuthority: 'existing_core_compliance_audit_authority',
    auditAuthority: audit.audit_authority,
    retentionAuthority: 'existing audit_retention_policies / Core compliance API',
    requestAuthority: 'existing compliance_requests / Core compliance API',
    exportAuthority: 'existing Core compliance export capability',
    persistence: 'none',
    ownsComplianceStore: false,
    ownsAuditStore: false,
    ownsRetentionPolicyStore: false,
    ownsComplianceRequests: false,
    ownsComplianceExport: false,
    implementationStatus: 'boundary_only',
  });
}

export function resolveEthiopiaComplianceBoundary({ organization = null, config = null, timezone = '' } = {}) {
  const identity = resolveEthiopiaIdentity({ organization, config, timezone });
  if (!identity.active) return Object.freeze({ active: false, boundary: null });
  return Object.freeze({ active: true, boundary: resolveCountryComplianceBoundary('ET') });
}

export const COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT = Object.freeze({
  phase: '14.8',
  authority: 'country_compliance_boundary',
  countryPackAuthority: 'app/src/country-pack-contract.js',
  complianceAuthority: 'existing Core compliance/audit implementation',
  auditAuthority: 'backend/lib/store-sqlite.js#recordAuditEvent / audit_events',
  retentionAuthority: 'backend/lib/store-sqlite.js#audit_retention_policies',
  requestAuthority: 'backend/lib/store-sqlite.js#compliance_requests',
  exportAuthority: 'backend/lib/store-sqlite.js#buildComplianceExport',
  persistence: 'none',
  ownsComplianceStore: false,
  ownsAuditStore: false,
  ownsRetentionPolicyStore: false,
  ownsComplianceRequests: false,
  ownsComplianceExport: false,
  ownsRegulatoryRules: false,
  implementationStatus: 'boundary_only',
  regulatoryStatus: 'country_defined_deferred',
  providerBoundary: 'Country Compliance Boundary → Existing Core Compliance/Audit Capability',
});
