import assert from 'node:assert/strict';
import { getCountryPack } from '../app/src/country-pack-contract.js';
import { resolveEthiopiaComplianceBoundary, resolveCountryComplianceBoundary, COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT } from '../app/src/country-compliance-boundary.js';
import { auditBoundaryContract } from '../app/src/audit/audit-boundary.js';

const pack = getCountryPack('ET');
assert.equal(pack.countryCode, 'ET');
assert.equal(pack.compliance.mode, 'country_defined');
assert.equal(pack.compliance.implementation, 'deferred');

const boundary = resolveCountryComplianceBoundary('ET');
assert.equal(boundary.countryCode, 'ET');
assert.equal(boundary.complianceAuthority, 'existing_core_compliance_audit_authority');
assert.equal(boundary.auditAuthority, 'existing backend audit_events / recordAuditEvent()');
assert.equal(boundary.retentionAuthority, 'existing audit_retention_policies / Core compliance API');
assert.equal(boundary.requestAuthority, 'existing compliance_requests / Core compliance API');
assert.equal(boundary.exportAuthority, 'existing Core compliance export capability');
assert.deepEqual(boundary.capabilities, [
  'audit_history', 'retention_policy', 'access_request', 'export_request', 'deletion_request',
]);
assert.equal(boundary.regulatoryRules, 'country_defined_deferred');
assert.equal(boundary.persistence, 'none');
assert.equal(boundary.ownsComplianceStore, false);
assert.equal(boundary.ownsAuditStore, false);
assert.equal(boundary.ownsRetentionPolicyStore, false);
assert.equal(boundary.ownsComplianceRequests, false);
assert.equal(boundary.ownsComplianceExport, false);
assert.equal(boundary.implementationStatus, 'boundary_only');

const audit = auditBoundaryContract();
assert.equal(audit.duplicate_audit_store, false);
assert.equal(audit.persistence, 'existing audit_events only');

const active = resolveEthiopiaComplianceBoundary({ organization: { country: 'ET' } });
assert.equal(active.active, true);
assert.equal(active.boundary.countryCode, 'ET');

const inactive = resolveEthiopiaComplianceBoundary({ organization: { country: 'KE' } });
assert.equal(inactive.active, false);
assert.equal(inactive.boundary, null);

assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.phase, '14.8');
assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.persistence, 'none');
assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.ownsComplianceStore, false);
assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.ownsAuditStore, false);
assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.ownsRegulatoryRules, false);
assert.equal(COUNTRY_COMPLIANCE_BOUNDARY_CONTRACT.regulatoryStatus, 'country_defined_deferred');

assert.throws(() => resolveCountryComplianceBoundary('KE'), /Unknown country pack/);

console.log('Phase 14.8 Ethiopia Compliance Boundary Regression: PASS');
