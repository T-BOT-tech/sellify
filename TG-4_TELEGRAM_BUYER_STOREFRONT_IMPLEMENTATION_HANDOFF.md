# TG-4 — Telegram Buyer Storefront Experience + Canonical Commerce Checkout Boundary

## Status
Implemented and regression-verified on the TG-3 source snapshot.

## Source-of-truth discipline
TG-4 inspected the existing public `/store/:chatId` storefront, catalog viewer, Marketplace checkout, tracking surface, Telegram platform adapter, TG-1 storefront configuration, and TG-2 BYOB credential boundary before changes.

## Implemented
- Public read-only `GET /api/telegram-storefront/:chatId` for published seller-owned Telegram storefront configuration.
- Public response exposes only buyer-safe channel metadata and enabled capabilities; credential references are never exposed.
- New `app/src/telegram-buyer-storefront.js` isolates Telegram buyer runtime behavior and capability checks.
- Existing `app/store.js` now detects Telegram WebApp context, applies Telegram buyer chrome, loads the published seller-owned storefront configuration, gates checkout by the seller-enabled capability, and uses the existing Marketplace checkout authority.
- Telegram buyer identity/profile is used only as optional buyer context; it does not create a new identity authority.
- Checkout requests now carry an idempotency key generated client-side and consumed by the existing Marketplace checkout idempotency mechanism.
- Existing catalog remains the canonical public product source.
- Existing tracking remains the canonical order-status path.

## Deliberately not implemented
- No Telegram Orders database.
- No Telegram cart persistence authority.
- No Telegram payment ledger.
- No Telegram inventory authority.
- No Telegram fulfillment/logistics authority.
- No seller-owned bot token handling in buyer code.
- No direct Telegram Bot API calls from the storefront or business store.
- No buyer authorization authority distinct from existing identity/payment/commerce boundaries.

## Buyer flow
`Telegram WebApp → Published Storefront Config → Public Catalog → Local Cart → Existing Marketplace Checkout → Existing Order/Tracking Authority`

The local cart is experience state only. A successful order is confirmed only by the canonical Commerce/Marketplace checkout response.

## Security / trust
The buyer client does not treat storefront configuration, price, stock, seller identity, or permissions as authoritative. Existing server-side checkout validation remains responsible for canonical totals, stock, and order creation.

## Verification
- `node phase0/tg4-telegram-buyer-storefront-regression.mjs` — PASS
- `node phase0/tg1-telegram-storefront-regression.mjs` — PASS
- `node phase0/tg2-telegram-byob-regression.mjs` — PASS
- `node phase0/golden-regression.mjs` — 21 PASS / 0 FAIL

Runtime: Node v22.16.0. Node >=24 remains the existing certification blocker.

## Next step
**TG-5 — Telegram buyer identity/session boundary and seller-bot WebApp authentication**, subject to the secure credential-provider boundary established in TG-2.
