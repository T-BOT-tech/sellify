# Phase 14.1 — Country Pack Contract

Status: COMPLETE

## Objective
Establish the smallest country-localization contract without moving country-specific tax, documents, payment, identity, inventory, commerce, authorization, audit, or event authority into a new store.

## Contract
The contract covers:
- countryCode
- currency
- locale
- languages
- tax
- documents
- phoneRules
- addressRules
- paymentProviders
- compliance
- numberFormats
- dateFormats

## Ethiopia seed
Ethiopia is represented as a contract-only pack with ET / ETB and en, am, om language identifiers. Tax, document, phone, address, and compliance behavior remain deferred until their dedicated Phase 14 subphases. Telebirr and CBE are declared provider candidates only; no provider integration is implemented here.

## Authority boundaries
- Existing Core currency/money remains authoritative.
- Existing i18n remains authoritative for translations.
- Existing payment configuration/core remains authoritative.
- This contract is persistence-neutral.
- No country database/store, tax engine, invoice engine, payment gateway, authorization evaluator, audit store, or event store is introduced.

## Provider rule
Country-specific providers must follow:
`Country Contract → Existing Core Capability → Adapter → Provider`

## Deliberately not changed
No Core currency, payment, invoice, tax, address, phone, i18n, organization, authorization, audit, or event implementation was rewritten. Ethiopia-specific runtime behavior remains deferred to later Phase 14 gates.
