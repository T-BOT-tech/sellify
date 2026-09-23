# Phase 15.1 — Multi-Country Pack Contract Hardening

## Objective

Harden the country-pack contract so additional countries can be introduced additively without creating a second commerce, inventory, payment, identity, authorization, audit, event, or persistence authority.

## Implementation

The existing `app/src/country-pack-contract.js` remains the single country-pack contract authority. The stable contract version remains `1.0`; this phase records hardening revision `1.1` without changing the existing 12 top-level fields or breaking Phase 14 consumers.

The validator now enforces:

- ISO-3166-1 alpha-2 country-code shape
- ISO-4217 currency-code shape
- BCP-47-like locale shape
- non-empty, unique lowercase language codes
- object shape for country capability sections
- unique payment-provider identifiers
- rejection of explicit country ownership claims for Core authorities

`assertCountryPack()` provides a fail-closed validation boundary with `COUNTRY_PACK_INVALID`.

## Authority boundary

Country packs remain declarative and persistence-free. They may describe local configuration and adapter mappings but do not own:

- commerce
- inventory
- payments
- customer/identity state
- authorization
- audit
- events
- persistence

The existing Core capability and adapter/provider boundaries remain authoritative.

## Compatibility

The existing Ethiopia pack remains unchanged in business meaning:

- country: `ET`
- currency: `ETB`
- locale: `en-ET`
- languages: `en`, `am`, `om`
- payment providers: `telebirr`, `cbe`

No additional country pack is installed in Phase 15.1.

## Regression

`node phase0/phase15.1-multi-country-pack-contract-regression.mjs` — PASS under the available Node 22.16.0 inspection runtime.

Node >=24 remains a project release requirement and is not certified by this phase.
