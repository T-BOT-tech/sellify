import assert from 'node:assert/strict';
const {
  TAX_BOUNDARY_EXPANSION_VERSION,
  TAX_BOUNDARY_EXPANSION_FORBIDDEN_AUTHORITIES,
  listTaxBoundaryProfiles,
  getTaxBoundaryProfile,
  validateTaxBoundaryProfile,
  assertTaxBoundaryProfile,
  taxBoundaryExpansionContract
} = await import('../app/src/tax-boundary-expansion-contract.js');
const expected = ['ET','KE','TZ','NG','GH','ZM','WAEMU','CEMAC','EAC'];
assert.equal(TAX_BOUNDARY_EXPANSION_VERSION, '1.0');
assert.deepEqual(listTaxBoundaryProfiles(), expected);
for (const code of expected) {
  const profile = getTaxBoundaryProfile(code);
  assert.equal(validateTaxBoundaryProfile(profile).valid, true);
  assert.doesNotThrow(() => assertTaxBoundaryProfile(profile));
  assert.equal(profile.implementation === 'deferred' || profile.implementation === 'regional_contract_only', true);
}
assert.equal(getTaxBoundaryProfile('WAEMU').mode, 'regional_harmonization_plus_country_overlay');
assert.equal(getTaxBoundaryProfile('CEMAC').mode, 'regional_harmonization_plus_country_overlay');
assert.equal(getTaxBoundaryProfile('EAC').mode, 'regional_harmonization_plus_country_overlay');
for (const authority of TAX_BOUNDARY_EXPANSION_FORBIDDEN_AUTHORITIES) {
  const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
  assert.equal(validateTaxBoundaryProfile({ ...getTaxBoundaryProfile('ET'), [property]: true }).valid, false, `${property} must fail closed`);
}
assert.throws(() => getTaxBoundaryProfile('XX'), (error) => error.code === 'TAX_BOUNDARY_PROFILE_UNKNOWN');
const contract = taxBoundaryExpansionContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.ownsTaxCalculation, false);
assert.equal(contract.ownsTaxLedger, false);
assert.equal(contract.ownsInvoiceTaxState, false);
assert.equal(contract.rates, 'not_defined');
assert.equal(contract.exemptions, 'not_defined');
assert.equal(contract.thresholds, 'not_defined');
console.log('Phase 15.12 Tax Boundary Expansion Regression: PASS');
console.log('Active country tax boundaries preserved: PASS');
console.log('Strategic country candidate boundaries preserved: PASS');
console.log('EAC / WAEMU / CEMAC regional tax posture is contract-only: PASS');
console.log('Country overlay remains mandatory: PASS');
console.log('No tax rates, exemptions, thresholds, ledger, or calculation authority introduced: PASS');
console.log('Forbidden tax authority claims fail closed: PASS');
