// Phase 15.1 — multi-country country-pack contract hardening.
// Declarative, persistence-neutral boundary. Country packs describe local
// behavior; they do not own Core commerce/payment/inventory/identity state.

export const COUNTRY_PACK_CONTRACT_VERSION = '1.0';

export const COUNTRY_PACK_FIELDS = Object.freeze([
  'countryCode', 'currency', 'locale', 'languages', 'tax', 'documents',
  'phoneRules', 'addressRules', 'paymentProviders', 'compliance',
  'numberFormats', 'dateFormats'
]);

const ISO_ALPHA2 = /^[A-Z]{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const L_CODE = /^[a-z]{2,3}$/;

const PACKS = Object.freeze({
  et: Object.freeze({
    countryCode: 'ET',
    currency: 'ETB',
    locale: 'en-ET',
    languages: Object.freeze(['en', 'am', 'om']),
    tax: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    documents: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    phoneRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    addressRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    paymentProviders: Object.freeze({ mode: 'adapter_registry', providers: Object.freeze(['telebirr', 'cbe']), implementation: 'deferred' }),
    compliance: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    numberFormats: Object.freeze({ decimalSeparator: '.', groupingSeparator: ',', implementation: 'contract_only' }),
    dateFormats: Object.freeze({ locale: 'en-ET', implementation: 'contract_only' })
  }),
  ke: Object.freeze({
    countryCode: 'KE',
    currency: 'KES',
    locale: 'en-KE',
    languages: Object.freeze(['en', 'sw']),
    tax: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    documents: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    phoneRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    addressRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    paymentProviders: Object.freeze({ mode: 'adapter_registry', providers: Object.freeze(['mpesa']), implementation: 'deferred' }),
    compliance: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    numberFormats: Object.freeze({ decimalSeparator: '.', groupingSeparator: ',', implementation: 'contract_only' }),
    dateFormats: Object.freeze({ locale: 'en-KE', implementation: 'contract_only' })
  }),
  tz: Object.freeze({
    countryCode: 'TZ',
    currency: 'TZS',
    locale: 'en-TZ',
    languages: Object.freeze(['en', 'sw']),
    tax: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    documents: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    phoneRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    addressRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    paymentProviders: Object.freeze({ mode: 'adapter_registry', providers: Object.freeze(['mpesa']), implementation: 'deferred' }),
    compliance: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    numberFormats: Object.freeze({ decimalSeparator: '.', groupingSeparator: ',', implementation: 'contract_only' }),
    dateFormats: Object.freeze({ locale: 'en-TZ', implementation: 'contract_only' })
  }),
  ng: Object.freeze({
    countryCode: 'NG',
    currency: 'NGN',
    locale: 'en-NG',
    languages: Object.freeze(['en', 'ha', 'ig', 'yo']),
    tax: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    documents: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    phoneRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    addressRules: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    paymentProviders: Object.freeze({ mode: 'adapter_registry', providers: Object.freeze([]), implementation: 'deferred' }),
    compliance: Object.freeze({ mode: 'country_defined', implementation: 'deferred' }),
    numberFormats: Object.freeze({ decimalSeparator: '.', groupingSeparator: ',', implementation: 'contract_only' }),
    dateFormats: Object.freeze({ locale: 'en-NG', implementation: 'contract_only' })
  })
});

export const COUNTRY_PACK_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence',
  'commerce',
  'inventory',
  'payments',
  'identity',
  'authorization',
  'audit',
  'events'
]);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function listCountryPacks() { return Object.keys(PACKS); }

export function getCountryPack(countryCode) {
  const key = String(countryCode || '').trim().toLowerCase();
  const aliases = Object.freeze({
    ethiopia: 'et',
    kenya: 'ke',
    'republic of kenya': 'ke',
    nigeria: 'ng',
    'federal republic of nigeria': 'ng',
    tanzania: 'tz',
    'united republic of tanzania': 'tz'
  });
  const pack = PACKS[aliases[key] || key];
  if (!pack) throw Object.assign(new Error(`Unknown country pack: ${countryCode}`), { code: 'COUNTRY_PACK_UNKNOWN' });
  return pack;
}

export function validateCountryPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return { valid: false, errors: ['pack must be an object'] };
  }

  for (const field of COUNTRY_PACK_FIELDS) {
    if (!hasOwn(pack, field)) errors.push(`missing:${field}`);
  }

  if (!ISO_ALPHA2.test(pack.countryCode || '')) errors.push('countryCode must be ISO-3166-1 alpha-2 shape');
  if (!ISO_CURRENCY.test(pack.currency || '')) errors.push('currency must be ISO-4217 shape');
  if (!BCP47.test(pack.locale || '')) errors.push('locale must be BCP-47-like shape');
  if (!Array.isArray(pack.languages) || pack.languages.length === 0) {
    errors.push('languages must be non-empty');
  } else {
    const invalidLanguages = pack.languages.filter((language) => !L_CODE.test(language));
    if (invalidLanguages.length) errors.push('languages must use lowercase ISO-like language codes');
    if (new Set(pack.languages).size !== pack.languages.length) errors.push('languages must be unique');
  }

  for (const field of ['tax', 'documents', 'phoneRules', 'addressRules', 'paymentProviders', 'compliance', 'numberFormats', 'dateFormats']) {
    if (!pack[field] || typeof pack[field] !== 'object' || Array.isArray(pack[field])) {
      errors.push(`${field} must be an object`);
    }
  }

  if (pack.paymentProviders && !Array.isArray(pack.paymentProviders.providers)) {
    errors.push('paymentProviders.providers must be an array');
  }
  if (pack.paymentProviders?.providers && new Set(pack.paymentProviders.providers).size !== pack.paymentProviders.providers.length) {
    errors.push('paymentProviders.providers must be unique');
  }

  // Country packs are declarative only. Any attempt to add explicit authority
  // ownership flags is rejected instead of silently accepting a second owner.
  for (const authority of COUNTRY_PACK_FORBIDDEN_AUTHORITIES) {
    if (hasOwn(pack, `owns${authority[0].toUpperCase()}${authority.slice(1)}`)) {
      errors.push(`forbidden:owns${authority[0].toUpperCase()}${authority.slice(1)}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertCountryPack(pack) {
  const validation = validateCountryPack(pack);
  if (!validation.valid) {
    const error = new Error(`Invalid country pack: ${validation.errors.join(', ')}`);
    error.code = 'COUNTRY_PACK_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return pack;
}

export function countryPackContract() {
  return Object.freeze({
    version: COUNTRY_PACK_CONTRACT_VERSION,
    hardeningRevision: '1.1',
    fields: [...COUNTRY_PACK_FIELDS],
    authority: 'country_pack_contract',
    persistence: 'none',
    ownsCoreCommerce: false,
    ownsInventory: false,
    ownsPayments: false,
    ownsIdentity: false,
    ownsAuthorization: false,
    ownsAudit: false,
    ownsEvents: false,
    providerBoundary: 'Country Contract → Existing Core Capability → Adapter → Provider',
    implementationStatus: 'contract_only',
    expansionPolicy: 'additive_country_pack_only',
    countryPackAuthority: Object.freeze({
      persistence: false,
      commerce: false,
      inventory: false,
      payments: false,
      identity: false,
      authorization: false,
      audit: false,
      events: false
    })
  });
}
