# TG-7 — Telegram Buyer Order History & Self-Service Handoff

## Scope
TG-7 extends the seller-owned Telegram WebApp from checkout/order tracking into buyer self-service order history while preserving existing SELLIFY authorities.

## Implemented
- Added canonical read projection `listTelegramBuyerOrders(chatId, telegramUserId, limit)` over existing `marketplace_orders` and `marketplace_seller_orders`.
- Added `GET /api/telegram-storefront/:chatId/orders`.
- Endpoint requires a published Telegram storefront and the existing `order_status` capability.
- Buyer identity is re-verified server-side from Telegram WebApp `initData` using the TG-2 seller-owned credential boundary.
- Order history is seller-scoped by `seller_id` and buyer identity.
- Added Telegram buyer "My orders" UI using the existing storefront experience.
- No tracking token is exposed by history; existing tracking authority remains protected by its canonical tracking token.
- No new order/session/tracking database was introduced.

## Architecture
Telegram WebApp → verified buyer context → canonical marketplace order projection → existing Commerce/Payment/Fulfillment/Logistics authorities.

## Security
- Never trust client-provided Telegram user identity for authorization.
- Never expose seller credentials or tracking token hashes.
- Cross-seller orders are excluded from the seller's Telegram history view.
- Invalid/missing buyer authentication fails closed.

## Deliberately not changed
- Commerce order authority
- Payment Core / ledger
- Inventory authority
- Fulfillment or Logistics authority
- Tracking-token authority
- Telegram bot credential storage
- Telegram session store
- New event/audit store

## Verification
- TG-7 regression: PASS
- TG-6 regression: PASS
- TG-5 regression: PASS
- TG-4 regression: PASS
- TG-2 regression: PASS
- TG-1 regression: PASS
- Golden Regression: 21 PASS / 0 FAIL
- Node runtime: v22.16.0; Node >=24 certification remains blocked.

## Next
TG-8 — Telegram fulfillment/tracking/proof-of-delivery/returns buyer experience, still projected from existing Fulfillment/Logistics/Returns authorities.
