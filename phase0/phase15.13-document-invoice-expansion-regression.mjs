import assert from 'node:assert/strict';
const {
  DOCUMENT_INVOICE_EXPANSION_VERSION,
  DOCUMENT_INVOICE_FORBIDDEN_AUTHORITIES,
  listDocumentInvoiceProfiles,
  getDocumentInvoiceProfile,
  validateDocumentInvoiceProfile,
  assertDocumentInvoiceProfile,
  documentInvoiceExpansionContract
} = await import('../app/src/document-invoice-expansion-contract.js');

const expected = ['ET','KE','TZ','NG','GH','ZM','EAC','WAEMU','CEMAC'];
assert.equal(DOCUMENT_INVOICE_EXPANSION_VERSION, '1.0');
assert.deepEqual(listDocumentInvoiceProfiles(), expected);
for (const code of expected) {
  const profile = getDocumentInvoiceProfile(code);
  assert.equal(validateDocumentInvoiceProfile(profile).valid, true);
  assert.doesNotThrow(() => assertDocumentInvoiceProfile(profile));
  assert.equal(profile.implementation === 'deferred' || profile.implementation === 'regional_contract_only', true);
}
assert.equal(getDocumentInvoiceProfile('KE').electronicInvoicing, 'tax_authority_defined_external');
for (const region of ['EAC','WAEMU','CEMAC']) {
  assert.equal(getDocumentInvoiceProfile(region).mode, 'regional_document_signal_plus_country_overlay');
  assert.equal(getDocumentInvoiceProfile(region).implementation, 'regional_contract_only');
}
for (const authority of DOCUMENT_INVOICE_FORBIDDEN_AUTHORITIES) {
  const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
  assert.equal(validateDocumentInvoiceProfile({ ...getDocumentInvoiceProfile('ET'), [property]: true }).valid, false, `${property} must fail closed`);
}
assert.throws(() => getDocumentInvoiceProfile('XX'), (error) => error.code === 'DOCUMENT_INVOICE_PROFILE_UNKNOWN');
const contract = documentInvoiceExpansionContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.ownsInvoicePersistence, false);
assert.equal(contract.ownsInvoiceNumbering, false);
assert.equal(contract.ownsDocumentLedger, false);
assert.equal(contract.ownsTaxState, false);
assert.equal(contract.countryOverlayRequired, true);
assert.deepEqual(contract.documentTypes, ['invoice']);
console.log('Phase 15.13 Document / Invoice Expansion Regression: PASS');
console.log('Active country document boundaries preserved: PASS');
console.log('Strategic country candidate boundaries preserved: PASS');
console.log('Kenya e-invoicing posture remains external tax-authority boundary: PASS');
console.log('EAC / WAEMU / CEMAC document posture remains contract-only: PASS');
console.log('Canonical Core invoice persistence / numbering remain authoritative: PASS');
console.log('No document ledger, tax state, payment state, or second invoice engine introduced: PASS');
console.log('Forbidden document/invoice authority claims fail closed: PASS');
