// Phase 15.13 — document / invoice expansion contract.
// Declarative boundary only. Existing Core B2B invoice persistence,
// numbering and API remain authoritative. Country profiles describe local
// document posture; they do not create a second invoice engine.

export const DOCUMENT_INVOICE_EXPANSION_VERSION = '1.0';

const FORBIDDEN = Object.freeze([
  'invoicePersistence', 'invoiceNumbering', 'documentLedger', 'taxState',
  'paymentState', 'commerce', 'payments', 'identity', 'authorization', 'audit', 'events'
]);

const PROFILES = Object.freeze({
  ET: Object.freeze({ countryCode: 'ET', scope: 'country', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'not_defined', sourceBoundary: 'country_document_boundary' }),
  KE: Object.freeze({ countryCode: 'KE', scope: 'country', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'tax_authority_defined_external', sourceBoundary: 'country_document_boundary' }),
  TZ: Object.freeze({ countryCode: 'TZ', scope: 'country', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'not_defined', sourceBoundary: 'country_document_boundary' }),
  NG: Object.freeze({ countryCode: 'NG', scope: 'country', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'not_defined', sourceBoundary: 'country_document_boundary' }),
  GH: Object.freeze({ countryCode: 'GH', scope: 'country_candidate', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'not_defined', sourceBoundary: 'country_document_boundary' }),
  ZM: Object.freeze({ countryCode: 'ZM', scope: 'country_candidate', mode: 'country_document_overlay', implementation: 'deferred', electronicInvoicing: 'not_defined', sourceBoundary: 'country_document_boundary' }),
  EAC: Object.freeze({ regionCode: 'EAC', scope: 'regional', mode: 'regional_document_signal_plus_country_overlay', implementation: 'regional_contract_only', electronicInvoicing: 'country_defined', sourceBoundary: 'country_document_boundary' }),
  WAEMU: Object.freeze({ regionCode: 'WAEMU', scope: 'regional', mode: 'regional_document_signal_plus_country_overlay', implementation: 'regional_contract_only', electronicInvoicing: 'country_defined', sourceBoundary: 'country_document_boundary' }),
  CEMAC: Object.freeze({ regionCode: 'CEMAC', scope: 'regional', mode: 'regional_document_signal_plus_country_overlay', implementation: 'regional_contract_only', electronicInvoicing: 'country_defined', sourceBoundary: 'country_document_boundary' })
});

export const DOCUMENT_INVOICE_FORBIDDEN_AUTHORITIES = FORBIDDEN;

export function listDocumentInvoiceProfiles() { return Object.keys(PROFILES); }

export function getDocumentInvoiceProfile(code) {
  const key = String(code || '').trim().toUpperCase();
  const profile = PROFILES[key];
  if (!profile) throw Object.assign(new Error(`Unknown document/invoice profile: ${code}`), { code: 'DOCUMENT_INVOICE_PROFILE_UNKNOWN' });
  return profile;
}

export function validateDocumentInvoiceProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { valid: false, errors: ['profile must be an object'] };
  for (const field of ['scope', 'mode', 'implementation', 'electronicInvoicing']) if (!profile[field]) errors.push(`${field} required`);
  for (const authority of FORBIDDEN) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(profile, property)) errors.push(`forbidden:${property}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertDocumentInvoiceProfile(profile) {
  const validation = validateDocumentInvoiceProfile(profile);
  if (!validation.valid) {
    const error = new Error(`Invalid document/invoice profile: ${validation.errors.join(', ')}`);
    error.code = 'DOCUMENT_INVOICE_PROFILE_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return profile;
}

export function documentInvoiceExpansionContract() {
  return Object.freeze({
    version: DOCUMENT_INVOICE_EXPANSION_VERSION,
    authority: 'document_invoice_expansion_contract',
    canonicalInvoiceAuthority: 'backend/lib/store-sqlite.js#invoices',
    canonicalInvoiceApi: 'backend/server.js#handleB2BInvoices',
    canonicalNumberingAuthority: 'existing_b2b_invoice_authority',
    persistence: 'none',
    ownsInvoicePersistence: false,
    ownsInvoiceNumbering: false,
    ownsDocumentLedger: false,
    ownsTaxState: false,
    countryOverlayRequired: true,
    regionalStrategy: 'regional_document_signal_plus_country_overlay',
    electronicInvoicingAdapters: 'deferred_external_provider_boundary',
    documentTypes: ['invoice'],
    migrationRequired: false,
    providerBoundary: 'Country Document Boundary → Existing Core Invoice Capability → External Tax/Document Provider Adapter'
  });
}
