// Phase 15.12 — tax boundary expansion contract.
// Declarative boundary only. It records regional/country tax implementation
// posture without calculating tax, storing tax state, or owning a tax ledger.

export const TAX_BOUNDARY_EXPANSION_VERSION = '1.0';

const FORBIDDEN = Object.freeze([
  'taxCalculation', 'taxLedger', 'taxPersistence', 'invoiceTaxState', 'paymentTaxState'
]);

const PROFILES = Object.freeze({
  ET: Object.freeze({ countryCode: 'ET', scope: 'country', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  KE: Object.freeze({ countryCode: 'KE', scope: 'country', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  TZ: Object.freeze({ countryCode: 'TZ', scope: 'country', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  NG: Object.freeze({ countryCode: 'NG', scope: 'country', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  GH: Object.freeze({ countryCode: 'GH', scope: 'country_candidate', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  ZM: Object.freeze({ countryCode: 'ZM', scope: 'country_candidate', mode: 'country_defined', implementation: 'deferred', sourceBoundary: 'country_tax_boundary' }),
  WAEMU: Object.freeze({ regionCode: 'WAEMU', scope: 'regional', mode: 'regional_harmonization_plus_country_overlay', implementation: 'regional_contract_only', sourceBoundary: 'country_tax_boundary' }),
  CEMAC: Object.freeze({ regionCode: 'CEMAC', scope: 'regional', mode: 'regional_harmonization_plus_country_overlay', implementation: 'regional_contract_only', sourceBoundary: 'country_tax_boundary' }),
  EAC: Object.freeze({ regionCode: 'EAC', scope: 'regional', mode: 'regional_harmonization_plus_country_overlay', implementation: 'regional_contract_only', sourceBoundary: 'country_tax_boundary' })
});

export const TAX_BOUNDARY_EXPANSION_FORBIDDEN_AUTHORITIES = FORBIDDEN;

export function listTaxBoundaryProfiles() { return Object.keys(PROFILES); }

export function getTaxBoundaryProfile(code) {
  const key = String(code || '').trim().toUpperCase();
  const profile = PROFILES[key];
  if (!profile) throw Object.assign(new Error(`Unknown tax boundary profile: ${code}`), { code: 'TAX_BOUNDARY_PROFILE_UNKNOWN' });
  return profile;
}

export function validateTaxBoundaryProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { valid: false, errors: ['profile must be an object'] };
  if (!profile.scope) errors.push('scope required');
  if (!profile.mode) errors.push('mode required');
  if (!profile.implementation) errors.push('implementation required');
  for (const authority of FORBIDDEN) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(profile, property)) errors.push(`forbidden:${property}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertTaxBoundaryProfile(profile) {
  const validation = validateTaxBoundaryProfile(profile);
  if (!validation.valid) {
    const error = new Error(`Invalid tax boundary profile: ${validation.errors.join(', ')}`);
    error.code = 'TAX_BOUNDARY_PROFILE_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return profile;
}

export function taxBoundaryExpansionContract() {
  return Object.freeze({
    version: TAX_BOUNDARY_EXPANSION_VERSION,
    authority: 'tax_boundary_expansion_contract',
    calculationAuthority: null,
    persistence: 'none',
    ownsTaxCalculation: false,
    ownsTaxLedger: false,
    ownsInvoiceTaxState: false,
    regionalStrategy: 'regional_harmonization_plus_country_overlay',
    countryStrategy: 'country_overlay_required',
    rates: 'not_defined',
    exemptions: 'not_defined',
    thresholds: 'not_defined',
    migrationRequired: false,
    providerBoundary: 'Country/Regional Tax Boundary → Existing Core Transaction Capability'
  });
}
