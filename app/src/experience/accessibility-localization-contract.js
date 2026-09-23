// FUX-15/FUX-16 — Accessibility + Localization experience contract.
// Product-experience evidence only: existing DOM/ARIA and i18n authorities remain canonical.

const RTL_LANGUAGES = Object.freeze(['ar', 'fa', 'he', 'ur']);
const ACCESSIBILITY_STATES = Object.freeze(['PASS', 'REVIEW', 'NOT_APPLICABLE']);

function normalizeLocale(locale) {
  return String(locale || 'en').trim().toLowerCase().replace('_', '-');
}

function languageOf(locale) {
  return normalizeLocale(locale).split('-')[0];
}

export function getTextDirection(locale) {
  return RTL_LANGUAGES.includes(languageOf(locale)) ? 'rtl' : 'ltr';
}

export function createAccessibilityContract(input = {}) {
  const checks = input.checks || {};
  const normalized = {};
  for (const [key, value] of Object.entries(checks)) {
    if (!ACCESSIBILITY_STATES.includes(value)) throw new Error(`Unsupported accessibility state: ${value}`);
    normalized[key] = value;
  }
  return Object.freeze({
    authority: 'existing semantic HTML / ARIA foundations',
    serverEnforcement: 'canonical authorization authority',
    requirements: Object.freeze([
      'keyboard-first',
      'screen-reader semantics',
      'visible-focus',
      'sufficient-contrast',
      'large-touch-targets',
      'non-color-only-status',
      'motion-respect',
    ]),
    checks: Object.freeze(normalized),
  });
}

export function createLocalizationContract(input = {}) {
  const locale = normalizeLocale(input.locale);
  const supportedLocales = [...new Set((input.supportedLocales || ['en']).map(normalizeLocale))];
  if (!supportedLocales.includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
  return Object.freeze({
    authority: 'app/src/ui/i18n.js + app/src/i18n/translations.js',
    locale,
    language: languageOf(locale),
    direction: getTextDirection(locale),
    supportedLocales: Object.freeze(supportedLocales),
    translationFallback: 'en',
    presentationDimensions: Object.freeze(['language', 'currency', 'dates', 'numbers', 'units', 'address', 'phone']),
    rtlReady: true,
  });
}

export function summarizeAccessibility(contract) {
  const values = Object.values(contract.checks);
  return Object.freeze({
    total: values.length,
    passed: values.filter(v => v === 'PASS').length,
    review: values.filter(v => v === 'REVIEW').length,
    notApplicable: values.filter(v => v === 'NOT_APPLICABLE').length,
  });
}
