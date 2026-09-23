# Phase 15.0 — Country Pack Expansion Baseline Lock

Status: COMPLETE — baseline lock only.

## Purpose

Freeze the Phase 14.15 prepared snapshot as the source baseline for Phase 15 country-pack expansion. This phase does not add a new country pack and does not alter Core commerce, inventory, payments, customers, fulfillment, authorization, audit, or event authorities.

## Baseline

The Phase 15 baseline is the exact Phase 14.15 final snapshot source tree. Phase 14.14 Node >=24 certification remains an outstanding release gate; this baseline does not claim Node >=24 certification.

## Expansion rules

1. Preserve the existing country-pack contract and Core authority boundaries.
2. Add countries only through the canonical country-pack contract.
3. Country packs remain configuration/adapter boundaries, not domain authorities.
4. No country-specific persistence schema is introduced by the baseline lock.
5. No silent country fallback/default pack is permitted.
6. Existing Ethiopia behavior remains unchanged.
7. Provider identifiers remain mappings only until their existing provider registry is operationally configured.
8. Country-specific tax, document, compliance, phone/address, and payment behavior remains behind explicit boundaries.
9. Future country additions must pass cumulative cross-country isolation regression.

## Current installed country set

- `ET` / Ethiopia is the only installed country pack.
- Unsupported country codes must fail closed with `COUNTRY_PACK_UNKNOWN`.

## Exit criteria

- Phase 14.15 snapshot exists and is structurally intact.
- Existing country-pack contract is present.
- Ethiopia remains the only installed pack.
- Existing cross-country fail-closed regression passes.
- No country expansion is silently introduced by the baseline lock.
