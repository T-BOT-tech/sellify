# Phase 14.9 — Country Configuration

## Purpose

Compose the Phase 14 country-pack boundaries into one runtime configuration projection without introducing a new persistence or configuration authority.

## Authority

- Organization country/currency/timezone: existing canonical organization authority.
- Client persisted configuration: existing `app/src/state.js` configuration.
- Country metadata: `app/src/country-pack-contract.js`.
- Country-specific boundaries: the Phase 14.2–14.8 bridge modules.

## Implementation

`app/src/country-configuration.js` provides `resolveCountryConfiguration()` and returns a frozen, non-persistent projection containing country identity, currency/locale/language/timezone, money, tax, document, phone/address, payment and compliance boundaries.

## Explicit non-goals

- no country configuration database/table
- no replacement for organization identity
- no replacement for `state.js`
- no mutation of Core configuration
- no country payment state or credentials
- no tax calculation or tax ledger
- no invoice/document persistence
- no compliance store
- no second country authority

## Migration

None. This phase is a read-only composition boundary. Existing authorities remain unchanged.
