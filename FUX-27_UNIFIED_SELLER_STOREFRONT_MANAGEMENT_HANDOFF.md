# FUX-27 — Unified Seller Storefront Management

## Status
Implemented and regression-verified on 2026-09-18 from the TG-10 source snapshot.

## Objective
Establish one seller-facing channel management model across storefront/distribution channels without creating duplicate business authorities.

## Contract
`app/src/platform/seller-channel-storefront-contract.js`

The generic contract currently recognizes Web, PWA, Telegram, Native Android, Native iOS, Embedded, and Partner channel types. It is declarative and presentation/distribution-oriented.

## Current implementation
- Generic seller-owned channel contract.
- Canonical Telegram configuration is projected into the generic channel summary.
- Authenticated endpoint: `GET /tenants/:chatId/storefront-channels`.
- Existing `settings:configure` authorization remains the seller administration boundary.
- Telegram remains the first concrete channel implementation.

## Authority rules
The channel layer does not own Commerce, Inventory, Payment Ledger, Fulfillment, Identity, Events, or Analytics. Existing domain authorities remain canonical.

## Deliberate scope boundary
No new database table or migration was required. Web/PWA/native channel configuration remains future work; the generic contract provides the boundary rather than inventing empty implementations.

## Verification
- FUX-27 focused regression: PASS
- Golden Regression: 21 PASS / 0 FAIL
- Syntax checks: PASS
- Runtime: Node 22.16.0
- Existing Node >=24 certification blocker remains open.

## Next
FUX-28 — Cross-Channel Consistency and canonical data/authority traceability.
