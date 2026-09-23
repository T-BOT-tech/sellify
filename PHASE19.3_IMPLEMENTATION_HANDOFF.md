# Phase 19.3 — Cross-Marketplace Product Discovery Handoff

## Status
IMPLEMENTED / REGRESSION-PASSED

## Authority boundary
The provider is read-only and delegates to the existing Commerce Marketplace/Product authority. It creates no product, seller, inventory, order, payment, or supplier identity authority.

## Implementation
- `backend/lib/discovery/provider-registry.js` — Phase 19.2 runtime provider registry.
- `backend/lib/discovery/marketplace-product-provider.js` — `commerce.marketplace` discovery provider.
- `backend/lib/discovery/index.js` — built-in provider bootstrap.
- `backend/server.js` — `GET /api/discovery/products` read-only discovery endpoint.

## Contract
Input query parameters: `q`/`search`, `category`, `currency`, `seller`.

Output is derived candidates with provider, source authority, source entity, organization identity, product reference, commercial signals, availability, evidence and owning-domain actions.

The endpoint explicitly reports `deterministic: true` and `ai: false`.

## Persistence
No migration added. No Discovery database authority added.

## Verification
- Phase 19.2 registry regression: PASS
- Phase 19.3 product discovery regression: PASS
- Phase 18.12 cumulative exit: PASS
- Node >=24: DEFERRED_TO_PHASE_16.13; observed runtime v22.16.0
