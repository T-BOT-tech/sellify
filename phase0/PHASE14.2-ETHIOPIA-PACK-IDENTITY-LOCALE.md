# Phase 14.2 — Ethiopia Pack Identity / Locale

## Objective
Connect the Phase 14.1 Ethiopia country-pack contract to the existing organization identity and localization boundaries without creating a second identity or locale authority.

## Existing authorities preserved
- Organization country/currency/timezone: canonical server-derived organization identity.
- Client persisted configuration: `app/src/state.js` remains the existing client configuration authority.
- Timezone country/currency hint: `app/src/config/locale-defaults.js` remains best-effort only.
- Translations: `app/src/i18n/translations.js` remains the i18n authority.
- Country-pack definition: `app/src/country-pack-contract.js` remains the country contract authority.

## Added boundary
`app/src/ethiopia-country-identity.js` provides a pure runtime projection:

`Organization Identity → Ethiopia Country Pack → Existing i18n/locale consumers`

It recognizes Ethiopia aliases, preserves explicit organization currency, defaults the Ethiopia timezone only when no timezone is supplied, and selects only existing `en`, `am`, or `om` language keys. Unsupported language values fall back to `en` for the projection only.

## Non-goals
- No new country database/table/column.
- No replacement of onboarding.
- No replacement of `locale-defaults.js`.
- No new translation system.
- No tax, invoice, compliance, or payment implementation.
- No country-owned customer/order/payment/inventory identity.

## Important authority rule
A timezone guess may help bootstrap a UI, but it cannot override explicit organization country or currency. The Ethiopia identity bridge is therefore active only when canonical organization country identifies Ethiopia.
