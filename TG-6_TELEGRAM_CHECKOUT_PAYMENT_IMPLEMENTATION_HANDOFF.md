# TG-6 — Telegram Checkout, Payment Capability Boundary & Buyer Order Experience

## Status
Implemented and regression-verified on 2026-09-18.

## Scope
TG-6 hardens the seller-owned Telegram buyer checkout boundary while preserving existing Commerce and Payment Core authorities.

## Implemented
- `app/src/platform/telegram-checkout-contract.js`
- Public Telegram storefront metadata now exposes a sanitized checkout/payment capability context.
- Telegram checkout is server-side gated by the seller's published `checkout` capability.
- Telegram order responses expose payment boundary metadata only; Telegram does not execute or record payment.
- Added buyer order-status endpoint that delegates to existing marketplace tracking and its canonical tracking token.
- Existing checkout idempotency remains authoritative.
- Existing Commerce order creation remains authoritative.
- Existing Payment Core remains authoritative for payment records/state.
- No Telegram payment ledger, payment store, order store, or inventory authority added.

## Payment boundary
`Telegram WebApp → Existing Commerce Checkout → Existing Payment Core`

A Telegram order can be created without Telegram directly confirming payment. Payment state is represented as `PENDING_SELLER_HANDLING` until the existing Payment Core records the relevant payment state.

## Deliberately not implemented
- Telegram-native payment ledger
- Telegram payment transaction authority
- Direct buyer-side mutation of Payment Core
- Direct Telegram-side inventory mutation
- New Telegram order database
- New Telegram session store
- New event/audit store

## Verification
- TG-6 regression: PASS
- Golden Regression: 21 PASS / 0 FAIL
- Backend syntax check: PASS
- Node runtime: 22.16.0; Node >=24 certification remains blocked by the established project runtime gap.

## Next
TG-7 — Telegram storefront order history / buyer self-service surface, using existing canonical order/tracking/returns authorities and without introducing a Telegram order authority.
