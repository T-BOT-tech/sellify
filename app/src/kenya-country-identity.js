// Phase 15.2 — Kenya country identity / locale bridge.
// Pure runtime projection over existing organization identity, application
// locale hints, and the country-pack contract. No persistence or Core identity
// ownership is introduced.

import { getCountryPack } from './country-pack-contract.js';

const KENYA_ALIASES = new Set(['ke', 'kenya', 'republic of kenya']);
const KENYA_TIMEZONE = 'Africa/Nairobi';
const SUPPORTED_LOCALES = Object.freeze(['en', 'sw']);

function normaliseText(value) { return String(value || '').trim(); }
function isKenyaCountry(value) { return KENYA_ALIASES.has(normaliseText(value).toLowerCase()); }
function localeLanguage(value) { return normaliseText(value).toLowerCase().replace('_', '-').split('-')[0]; }

export function resolveKenyaIdentity({ organization = null, config = null, timezone = '' } = {}) {
  const country = normaliseText(organization?.country || config?.country || '');
  const currency = normaliseText(organization?.currency || config?.currencyCode || '');
  const orgTimezone = normaliseText(organization?.timezone || timezone || '');

  if (!isKenyaCountry(country)) {
    return Object.freeze({ active: false, countryCode: '', currency: currency || '', timezone: orgTimezone || '', language: localeLanguage(config?.lang) || 'en', locale: normaliseText(config?.lang) || 'en', pack: null });
  }

  const pack = getCountryPack('KE');
  const requestedLanguage = localeLanguage(config?.lang);
  const language = SUPPORTED_LOCALES.includes(requestedLanguage) ? requestedLanguage : 'en';

  return Object.freeze({
    active: true,
    countryCode: pack.countryCode,
    currency: currency || pack.currency,
    timezone: orgTimezone || KENYA_TIMEZONE,
    language,
    locale: language,
    pack,
  });
}

export function isKenyaIdentity(identity) {
  return Boolean(identity?.active && identity?.countryCode === 'KE');
}

export const KENYA_COUNTRY_IDENTITY_CONTRACT = Object.freeze({
  countryCode: 'KE',
  canonicalCountryAuthority: 'organization.country',
  canonicalCurrencyAuthority: 'organization.currency',
  timezoneDefault: KENYA_TIMEZONE,
  supportedLanguages: [...SUPPORTED_LOCALES],
  fallbackLanguage: 'en',
  i18nAuthority: 'app/src/i18n/translations.js',
  localeHintAuthority: 'app/src/config/locale-defaults.js',
  packAuthority: 'app/src/country-pack-contract.js',
  persistence: 'none',
  replacesOnboarding: false,
  ownsIdentity: false,
});
