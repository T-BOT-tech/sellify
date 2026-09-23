# P1-IMPLEMENTATION-17 — Pack Accessibility & Localization UX

## Purpose

Productize the existing localization and accessibility foundations across the Pack/IAM surfaces without creating a second translation, locale, or accessibility authority.

## Implemented

- Added `app/src/authorization/pack-accessibility-localization.js`.
- Integrated the surface into Settings.
- Added semantic accessibility hooks for Pack/IAM panels:
  - `aria-live="polite"` on dynamic panels/status regions
  - `role="status"` for status messages
  - table header `scope="col"` semantics
- Added locale evidence using the existing `TRANSLATIONS` registry and `ui/i18n.js` authority.
- Sets/validates document language through the existing i18n flow.
- Defines direction handling without creating a second locale authority.
- Added localized contract keys to the existing locale files; existing English fallback remains authoritative when a translation is absent.
- Explicitly states that localization and accessibility do not grant authorization.

## Authority boundaries

- Localization authority: `app/src/ui/i18n.js` + `app/src/i18n/translations.js`
- Accessibility authority: existing semantic HTML / ARIA foundations
- Authorization remains server-side and canonical.
- No second locale store, translation registry, accessibility evaluator, or IAM evaluator was introduced.

## Validation

- P1-17 focused regression: PASS
- JavaScript syntax checks: PASS
- FUX-29 seller golden journey regression: PASS
- FUX-30 multi-channel adversarial regression: PASS
- Node runtime: current environment is Node 22.16.0; Node >=24 release certification remains a separate gate.
