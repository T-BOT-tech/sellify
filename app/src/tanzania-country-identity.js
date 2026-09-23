// Phase 15.7 — Tanzania country identity / locale bridge.
// Pure runtime projection over existing organization identity, application
// locale hints, and the country-pack contract. No persistence or Core identity
// ownership is introduced.

import { getCountryPack } from './country-pack-contract.js';

const TANZANIA_ALIASES = new Set(['tz', 'tanzania', 'united republic of tanzania']);
const TANZANIA_TIMEZONE = 'Africa/Dar_es_Salaam';
const SUPPORTED_LOCALES = Object.freeze(['en', 'sw']);

function normaliseText(value) { return String(value || '').trim(); }
function isTanzaniaCountry(value) { return TANZANIA_ALIASES.has(normaliseText(value).toLowerCase()); }
function localeLanguage(value) { return normaliseText(value).toLowerCase().replace('_', '-').split('-')[0]; }

export function resolveTanzaniaIdentity({ organization = null, config = null, timezone = '' } = {}) {
  const country = normaliseText(organization?.country || config?.country || '');
  const currency = normaliseText(organization?.currency || config?.currencyCode || '');
  const orgTimezone = normaliseText(organization?.timezone || timezone || '');

  if (!isTanzaniaCountry(country)) {
    return Object.freeze({ active: false, countryCode: '', currency: currency || '', timezone: orgTimezone || '', language: localeLanguage(config?.lang) || 'en', locale: normaliseText(config?.lang) || 'en', pack: null });
  }

  const pack = getCountryPack('TZ');
  const requestedLanguage = localeLanguage(config?.lang);
  const language = SUPPORTED_LOCALES.includes(requestedLanguage) ? requestedLanguage : 'en';

  return Object.freeze({
    active: true,
    countryCode: pack.countryCode,
    currency: currency || pack.currency,
    timezone: orgTimezone || TANZANIA_TIMEZONE,
    language,
    locale: language,
    pack,
  });
}

export function isTanzaniaIdentity(identity) {
  return Boolean(identity?.active && identity?.countryCode === 'TZ');
}

export const TANZANIA_COUNTRY_IDENTITY_CONTRACT = Object.freeze({
  countryCode: 'TZ',
  canonicalCountryAuthority: 'organization.country',
  canonicalCurrencyAuthority: 'organization.currency',
  timezoneDefault: TANZANIA_TIMEZONE,
  supportedLanguages: [...SUPPORTED_LOCALES],
  fallbackLanguage: 'en',
  i18nAuthority: 'app/src/i18n/translations.js',
  localeHintAuthority: 'app/src/config/locale-defaults.js',
  packAuthority: 'app/src/country-pack-contract.js',
  persistence: 'none',
  replacesOnboarding: false,
  ownsIdentity: false,
});
