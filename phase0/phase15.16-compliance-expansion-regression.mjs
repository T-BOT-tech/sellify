// Phase 15.16 — Compliance Expansion regression.
import assert from 'node:assert/strict';
import { getCountryPack } from '../app/src/country-pack-contract.js';
import { resolveCountryComplianceBoundary } from '../app/src/country-compliance-boundary.js';
import {
  COMPLIANCE_EXPANSION_CONTRACT_VERSION,
  COMPLIANCE_EXPANSION_FORBIDDEN_AUTHORITIES,
  listComplianceExpansionCountries,
  listComplianceExpansionCandidates,
  listComplianceExpansionRegions,
  getComplianceExpansionCountry,
  getComplianceExpansionRegion,
  validateComplianceExpansionProfile,
  assertComplianceExpansionProfile,
  complianceExpansionContract,
} from '../app/src/compliance-expansion-contract.js';

assert.equal(COMPLIANCE_EXPANSION_CONTRACT_VERSION, '1.0');
assert.deepEqual(listComplianceExpansionCountries(), ['ET', 'KE', 'TZ', 'NG']);
assert.deepEqual(listComplianceExpansionCandidates(), ['GH', 'ZM']);
assert.deepEqual(listComplianceExpansionRegions(), ['EAC', 'WAEMU', 'CEMAC']);

for (const code of ['ET', 'KE', 'TZ', 'NG']) {
  const pack = getCountryPack(code);
  const profile = getComplianceExpansionCountry(code);
  assert.equal(profile.scope, 'country_overlay');
  assert.equal(profile.status, 'active_country_pack');
  assert.equal(pack.compliance.mode, 'country_defined');
  assert.equal(resolveCountryComplianceBoundary(code).persistence, 'none');
}

for (const code of ['GH', 'ZM']) {
  const profile = getComplianceExpansionCountry(code);
  assert.equal(profile.scope, 'country_candidate');
  assert.equal(profile.status, 'strategic_candidate');
}

for (const region of ['EAC', 'WAEMU', 'CEMAC']) {
  const profile = getComplianceExpansionRegion(region);
  assert.equal(profile.scope, 'regional_signal_plus_country_overlay');
  assert.equal(profile.status, 'regional_contract_only');
}

assert.throws(() => getComplianceExpansionCountry('XX'), /Unknown compliance country/);
assert.throws(() => getComplianceExpansionRegion('EU'), /Unknown compliance region/);

const contract = complianceExpansionContract();
assert.equal(contract.authority, 'compliance_expansion_boundary');
assert.equal(contract.persistence, 'none');
assert.equal(contract.existingComplianceAuthority.includes('existing Core compliance/audit'), true);
assert.equal(contract.ownsComplianceStore, false);
assert.equal(contract.ownsAuditStore, false);
assert.equal(contract.ownsRetentionPolicyStore, false);
assert.equal(contract.ownsComplianceRequests, false);
assert.equal(contract.ownsComplianceExport, false);
assert.equal(contract.ownsRegulatoryRules, false);
assert.equal(contract.ownsSanctionsStore, false);
assert.equal(contract.ownsAmlEngine, false);
assert.equal(contract.ownsKycEngine, false);
assert.equal(contract.ownsBeneficialOwnershipStore, false);
assert.equal(contract.countryOverlayRequired, true);

assert.equal(validateComplianceExpansionProfile(getComplianceExpansionCountry('ET')).valid, true);
assert.equal(validateComplianceExpansionProfile(getComplianceExpansionRegion('EAC')).valid, true);
for (const authority of COMPLIANCE_EXPANSION_FORBIDDEN_AUTHORITIES) {
  const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
  assert.throws(() => assertComplianceExpansionProfile({ countryCode: 'ET', scope: 'country_overlay', status: 'active_country_pack', [property]: true }), /Invalid compliance expansion profile/);
}

console.log('Phase 15.16 Compliance Expansion Regression: PASS');
