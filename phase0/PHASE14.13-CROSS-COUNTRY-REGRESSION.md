# Phase 14.13 — Cross-Country Regression

## Purpose

Validate that country-pack behavior remains isolated, deterministic, and fail-closed when only Ethiopia is installed, while preserving the canonical Core authorities.

## Scope

- Re-run Phase 14.0 through 14.12 regressions.
- Confirm Ethiopia resolves canonically as `ET`.
- Confirm aliases `ET` and `ethiopia` resolve to the same pack.
- Confirm unsupported countries do not silently fall back to Ethiopia or another pack.
- Confirm country configuration fails closed for unsupported countries.
- Confirm country event integration fails closed for unsupported countries.
- Confirm country packs do not own authorization, events, or payment authority.

## Boundary

Cross-country support is not implemented by duplicating domain cores. A future country is introduced only by adding a validated country-pack contract and its bounded adapters/configuration. Until then, an unsupported country must fail closed.

## Authorities preserved

- Organization identity: existing Core organization authority.
- Authorization/isolation: Phase 13.12 security authorities.
- Commerce, inventory, payments, customers, fulfillment and audit: existing Core authorities.
- Events/outbox: existing versioned event and outbox boundaries.

## Result

Phase 14.13 passes when the cumulative 14.0–14.12 regression chain passes and all unsupported-country isolation assertions pass.

Node >=24 remains a release requirement; this regression does not certify the runtime version.
