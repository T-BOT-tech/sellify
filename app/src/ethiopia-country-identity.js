// Phase 14.2 — Ethiopia country identity / locale bridge.
// Pure runtime projection over existing organization identity, onboarding
// locale hints, and the Phase 14.1 country-pack contract. It does not create
// a country persistence authority, replace i18n, or mutate Core identity.

import { getCountryPack } from './country-pack-contract.js';

const ETHIOPIA_ALIASES = new Set(['et', 'ethiopia', 'ethiopia federal democratic republic']);
const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';
const SUPPORTED_LOCALES = Object.freeze(['en', 'am', 'om']);

function normaliseText(value) {
  return String(value || '').trim();
}

function isEthiopiaCountry(value) {
  return ETHIOPIA_ALIASES.has(normaliseText(value).toLowerCase());
}

function localeLanguage(value) {
  const raw = normaliseText(value).toLowerCase().replace('_', '-');
  return raw.split('-')[0];
}

/**
 * Resolve an Ethiopia-aware runtime identity without overriding explicit
 * organization identity. Organization country/currency/timezone remain the
 * canonical server-derived authority; this module only provides a stable
 * country-pack projection for UI/localization consumers.
 */
export function resolveEthiopiaIdentity({ organization = null, config = null, timezone = '' } = {}) {
  const country = normaliseText(organization?.country || config?.country || '');
  const currency = normaliseText(organization?.currency || config?.currencyCode || '');
  const orgTimezone = normaliseText(organization?.timezone || timezone || '');

  if (!isEthiopiaCountry(country)) {
    return Object.freeze({ active: false, countryCode: '', currency: currency || '', timezone: orgTimezone || '', language: localeLanguage(config?.lang) || 'en', locale: normaliseText(config?.lang) || 'en', pack: null });
  }

  const pack = getCountryPack('ET');
  const requestedLanguage = localeLanguage(config?.lang);
  const language = SUPPORTED_LOCALES.includes(requestedLanguage) ? requestedLanguage : 'en';

  return Object.freeze({
    active: true,
    countryCode: pack.countryCode,
    currency: currency || pack.currency,
    timezone: orgTimezone || ETHIOPIA_TIMEZONE,
    language,
    locale: language,
    pack,
  });
}

export function isEthiopiaIdentity(identity) {
  return Boolean(identity?.active && identity?.countryCode === 'ET');
}

export const ETHIOPIA_COUNTRY_IDENTITY_CONTRACT = Object.freeze({
  countryCode: 'ET',
  canonicalCountryAuthority: 'organization.country',
  canonicalCurrencyAuthority: 'organization.currency',
  timezoneDefault: ETHIOPIA_TIMEZONE,
  supportedLanguages: [...SUPPORTED_LOCALES],
  fallbackLanguage: 'en',
  i18nAuthority: 'app/src/i18n/translations.js',
  localeHintAuthority: 'app/src/config/locale-defaults.js',
  packAuthority: 'app/src/country-pack-contract.js',
  persistence: 'none',
  replacesOnboarding: false,
  ownsIdentity: false,
});
