# Phase 14.0 — Country Pack Baseline Lock

Status: COMPLETE — baseline locked from the Phase 13.12.17 prepared snapshot.

## Objective
Establish the implementation baseline for country localization without moving
country-specific tax, document, payment, phone, address, or compliance logic into
Sellify Core.

## Roadmap contract
Phase 14 country packs cover Currency, Locale, Languages, Tax, Documents,
Phone Rules, Address Rules, Payment Providers, Compliance, Number Formats, and
Date Formats. Ethiopia is the first implementation candidate.

## Source-derived existing authorities
- Organization country/currency/timezone: `backend/lib/store-sqlite.js` organization authority.
- Client persisted configuration: `app/src/state.js`.
- Currency formatting: `app/src/config/currency.js` + `app/src/utils/money.js`.
- Locale defaults: `app/src/config/locale-defaults.js` (best-effort onboarding hint only).
- Languages: `app/src/i18n/translations.js` and `app/src/i18n/locales/*`.
- Payment provider boundary: `backend/lib/payments/provider-registry.js`.
- Payment channel boundary: `backend/lib/payments/channel-registry.js`.
- B2B invoice behavior: existing B2B invoice domain/server implementation.

## Rules locked
1. Country packs are adapters/configuration, not a second commerce core.
2. Country packs must not own inventory, payment state/ledger, customer identity,
   order state, fulfillment, authorization, audit, or event persistence.
3. Provider-specific behavior remains behind the existing provider adapter boundary.
4. Existing currency/money behavior is preserved until a deliberate migration
   proves any scale change safe.
5. Existing timezone country guessing remains non-authoritative.
6. Country-specific tax/document/compliance rules stay outside universal Core.
7. No country persistence schema is introduced in this baseline lock.
8. No payment provider is enabled or claimed operational merely because a provider
   identifier exists in the registry.

## Ethiopia scope recorded for subsequent implementation
The roadmap names ETB, Amharic, Afaan Oromo, English, Telebirr, CBE, local tax,
local invoice rules, phone/address conventions, and compliance as the first
country-pack target. These are scope items, not claims that every item is already
implemented.

## Deliberately not changed
No production authority, database schema, payment provider implementation,
tax engine, invoice engine, locale engine, phone/address validator, or compliance
engine was added in 14.0. The purpose of this subphase is baseline lock and
source-of-truth mapping only.
