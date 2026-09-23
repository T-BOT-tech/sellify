# Phase 15.3 — Nigeria Country Pack Identity / Locale

## Scope
Add Nigeria as an additive country-pack identity/locale projection.

## Contract
- Country: NG
- Currency: NGN
- Default locale: en-NG
- Supported locale languages: en, ha, ig, yo
- Timezone fallback: Africa/Lagos
- Country aliases: NG, Nigeria, Federal Republic of Nigeria

## Authority boundaries
- Organization country/currency remain canonical.
- Existing i18n remains authoritative for translations.
- This bridge has no persistence.
- This bridge does not own customer identity, commerce, inventory, payments, authorization, audit, or events.
- Payment providers remain deferred; no provider execution or credentials are introduced.
- Tax, documents, phone/address and compliance remain country-defined/deferred boundaries until separately approved.

## Migration posture
Additive only. No replacement of Ethiopia or Kenya. No historical regression is rewritten to conceal the expansion.
