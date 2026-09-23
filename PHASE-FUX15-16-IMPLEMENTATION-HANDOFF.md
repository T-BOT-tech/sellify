# FUX-15 / FUX-16 Implementation Handoff — 2026-09-20

## Status

IMPLEMENTED — ACCESSIBILITY + LOCALIZATION EXPERIENCE CONTRACT

## Scope

This slice productizes FUX-15 Accessibility and FUX-16 Localization without creating a second authority.

### FUX-15
- Keyboard-first
- Screen-reader semantics
- Visible focus
- Sufficient contrast
- Large touch targets
- Non-color-only status
- Motion respect
- Existing semantic HTML / ARIA remains the accessibility authority.

### FUX-16
- Language
- Currency
- Dates
- Numbers
- Units
- Address / phone presentation
- RTL readiness
- Existing `app/src/ui/i18n.js` and `app/src/i18n/translations.js` remain the localization authority.

## Added

- `app/src/experience/accessibility-localization-contract.js`
- `phase0/fux15-16-accessibility-localization-regression.mjs`

## Verification

- FUX-15/FUX-16 regression: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL

## Certification

Final FUX certification remains blocked until the existing Node >=24 release gate is executed successfully in a Node >=24 environment.

Node 22 evidence is not promoted to Node >=24 certification.
