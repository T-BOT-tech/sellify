import assert from 'node:assert/strict';
import { resolveCountryDocumentBoundary, resolveEthiopiaDocumentBoundary, projectCountryInvoiceDocument, COUNTRY_DOCUMENT_BOUNDARY_CONTRACT } from '../app/src/country-document-boundary.js';
import { resolveCountryTaxBoundary } from '../app/src/country-tax-boundary.js';

const boundary = resolveCountryDocumentBoundary('ET');
assert.equal(boundary.countryCode, 'ET');
assert.equal(boundary.mode, 'country_defined');
assert.equal(boundary.implementation, 'deferred');
assert.deepEqual(boundary.supportedDocumentTypes, ['invoice']);
assert.equal(boundary.invoicePersistenceAuthority, 'backend/lib/store-sqlite.js#invoices');
assert.equal(boundary.invoiceApiAuthority, 'backend/server.js#handleB2BInvoices');
assert.equal(boundary.numberingAuthority, 'existing_b2b_invoice_authority');
assert.equal(boundary.persistence, 'none');
assert.equal(boundary.ownsInvoicePersistence, false);
assert.equal(boundary.ownsInvoiceNumbering, false);
assert.equal(boundary.ownsTaxState, false);
assert.equal(boundary.ownsDocumentLedger, false);

const inactive = resolveEthiopiaDocumentBoundary({ organization: { country: 'Kenya' } });
assert.equal(inactive.active, false);
assert.equal(inactive.boundary, null);

const active = resolveEthiopiaDocumentBoundary({ organization: { country: 'Ethiopia', currency: 'ETB' } });
assert.equal(active.active, true);
assert.equal(active.boundary.countryCode, 'ET');

const projection = projectCountryInvoiceDocument({ id: 'inv-1', invoiceNumber: 'INV-000001', status: 'DRAFT', currency: 'ETB' }, 'ET');
assert.deepEqual(projection, {
  documentType: 'invoice', countryCode: 'ET', documentId: 'inv-1', invoiceNumber: 'INV-000001',
  status: 'DRAFT', currency: 'ETB', localeMode: 'country_identity_and_existing_i18n',
  taxMode: 'country_tax_boundary', sourceAuthority: 'existing_b2b_invoice_authority', persistence: 'none'
});

assert.equal(COUNTRY_DOCUMENT_BOUNDARY_CONTRACT.invoiceAuthority, 'backend/lib/store-sqlite.js#invoices');
assert.equal(COUNTRY_DOCUMENT_BOUNDARY_CONTRACT.ownsInvoicePersistence, false);
assert.equal(COUNTRY_DOCUMENT_BOUNDARY_CONTRACT.ownsInvoiceNumbering, false);
assert.equal(resolveCountryTaxBoundary('ET').ownsInvoiceTaxState, false);

assert.throws(() => projectCountryInvoiceDocument(null), /invoice is required/);

console.log('Phase 14.5 Document / Invoice Boundary Regression: PASS');
console.log('Existing B2B invoice authority preserved: PASS');
console.log('Ethiopia document boundary remains deferred / contract-only: PASS');
console.log('No country invoice persistence / numbering / ledger authority: BLOCKED');
