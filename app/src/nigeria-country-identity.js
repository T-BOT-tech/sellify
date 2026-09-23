// Phase 15.3 — Nigeria country identity / locale bridge.
// Pure runtime projection over existing organization identity, application
// locale hints, and the country-pack contract. No persistence or Core identity
// ownership is introduced.

import { getCountryPack } from './country-pack-contract.js';

const NIGERIA_ALIASES = new Set(['ng', 'nigeria', 'federal republic of nigeria']);
const NIGERIA_TIMEZONE = 'Africa/Lagos';
const SUPPORTED_LOCALES = Object.freeze(['en', 'ha', 'ig', 'yo']);

function normaliseText(value) { return String(value || '').trim(); }
function isNigeriaCountry(value) { return NIGERIA_ALIASES.has(normaliseText(value).toLowerCase()); }
function localeLanguage(value) { return normaliseText(value).toLowerCase().replace('_', '-').split('-')[0]; }

export function resolveNigeriaIdentity({ organization = null, config = null, timezone = '' } = {}) {
  const country = normaliseText(organization?.country || config?.country || '');
  const currency = normaliseText(organization?.currency || config?.currencyCode || '');
  const orgTimezone = normaliseText(organization?.timezone || timezone || '');

  if (!isNigeriaCountry(country)) {
    return Object.freeze({ active: false, countryCode: '', currency: currency || '', timezone: orgTimezone || '', language: localeLanguage(config?.lang) || 'en', locale: normaliseText(config?.lang) || 'en', pack: null });
  }

  const pack = getCountryPack('NG');
  const requestedLanguage = localeLanguage(config?.lang);
  const language = SUPPORTED_LOCALES.includes(requestedLanguage) ? requestedLanguage : 'en';

  return Object.freeze({
    active: true,
    countryCode: pack.countryCode,
    currency: currency || pack.currency,
    timezone: orgTimezone || NIGERIA_TIMEZONE,
    language,
    locale: language,
    pack,
  });
}

export function isNigeriaIdentity(identity) {
  return Boolean(identity?.active && identity?.countryCode === 'NG');
}

export const NIGERIA_COUNTRY_IDENTITY_CONTRACT = Object.freeze({
  countryCode: 'NG',
  canonicalCountryAuthority: 'organization.country',
  canonicalCurrencyAuthority: 'organization.currency',
  timezoneDefault: NIGERIA_TIMEZONE,
  supportedLanguages: [...SUPPORTED_LOCALES],
  fallbackLanguage: 'en',
  i18nAuthority: 'app/src/i18n/translations.js',
  localeHintAuthority: 'app/src/config/locale-defaults.js',
  packAuthority: 'app/src/country-pack-contract.js',
  persistence: 'none',
  replacesOnboarding: false,
  ownsIdentity: false,
});
