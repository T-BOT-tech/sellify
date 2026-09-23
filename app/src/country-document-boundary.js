// Phase 14.5 — country document / invoice boundary.
// Declarative bridge over the existing canonical B2B invoice authority.
// It does not create invoice persistence, numbering state, tax state, or a
// second document engine.

import { getCountryPack } from './country-pack-contract.js';
import { resolveEthiopiaIdentity } from './ethiopia-country-identity.js';

const DOCUMENT_TYPES = Object.freeze(['invoice']);

export function resolveCountryDocumentBoundary(countryCode = 'ET') {
  const pack = getCountryPack(countryCode);
  return Object.freeze({
    countryCode: pack.countryCode,
    mode: pack.documents.mode,
    implementation: pack.documents.implementation,
    supportedDocumentTypes: [...DOCUMENT_TYPES],
    documentAuthority: 'existing_b2b_invoice_authority',
    invoicePersistenceAuthority: 'backend/lib/store-sqlite.js#invoices',
    invoiceApiAuthority: 'backend/server.js#handleB2BInvoices',
    numberingAuthority: 'existing_b2b_invoice_authority',
    localeAuthority: 'country_identity_and_existing_i18n',
    formattingAuthority: 'existing_core_document_capability',
    taxAuthority: 'app/src/country-tax-boundary.js',
    persistence: 'none',
    ownsInvoicePersistence: false,
    ownsInvoiceNumbering: false,
    ownsTaxState: false,
    ownsDocumentLedger: false,
    implementationStatus: 'boundary_only',
  });
}

export function resolveEthiopiaDocumentBoundary({ organization = null, config = null, timezone = '' } = {}) {
  const identity = resolveEthiopiaIdentity({ organization, config, timezone });
  if (!identity.active) return Object.freeze({ active: false, boundary: null });
  return Object.freeze({ active: true, boundary: resolveCountryDocumentBoundary('ET') });
}

/**
 * Project an existing canonical invoice into a country-document descriptor.
 * The supplied invoice remains authoritative; no fields are persisted or
 * rewritten here.
 */
export function projectCountryInvoiceDocument(invoice, countryCode = 'ET') {
  if (!invoice || typeof invoice !== 'object') {
    throw Object.assign(new Error('invoice is required'), { code: 'INVOICE_REQUIRED' });
  }
  const boundary = resolveCountryDocumentBoundary(countryCode);
  return Object.freeze({
    documentType: 'invoice',
    countryCode: boundary.countryCode,
    documentId: String(invoice.id || ''),
    invoiceNumber: String(invoice.invoiceNumber || ''),
    status: String(invoice.status || ''),
    currency: String(invoice.currency || ''),
    localeMode: 'country_identity_and_existing_i18n',
    taxMode: 'country_tax_boundary',
    sourceAuthority: boundary.documentAuthority,
    persistence: 'none',
  });
}

export const COUNTRY_DOCUMENT_BOUNDARY_CONTRACT = Object.freeze({
  phase: '14.5',
  authority: 'country_document_boundary',
  countryPackAuthority: 'app/src/country-pack-contract.js',
  invoiceAuthority: 'backend/lib/store-sqlite.js#invoices',
  invoiceApiAuthority: 'backend/server.js#handleB2BInvoices',
  numberingAuthority: 'existing_b2b_invoice_authority',
  taxBoundaryAuthority: 'app/src/country-tax-boundary.js',
  persistence: 'none',
  ownsInvoicePersistence: false,
  ownsInvoiceNumbering: false,
  ownsTaxState: false,
  ownsDocumentLedger: false,
  replacesCoreCommerce: false,
  implementationStatus: 'boundary_only',
  providerBoundary: 'Country Document Boundary → Existing Core Invoice Capability',
});
