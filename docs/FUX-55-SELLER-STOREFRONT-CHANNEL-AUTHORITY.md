# FUX-55 — Seller Storefront Channel + Telegram Seller Configuration Authority

## Objective
Connect the seller-facing storefront channel and Telegram configuration experience to the existing canonical backend authority without creating a second local channel or credential authority.

## Canonical path
Settings → seller channel intent → canonical storefront/Telegram API → server authorization + validation → SQLite channel authority → audit → canonical response → UI projection.

## Canonical endpoints
- GET /tenants/:chatId/storefront-channels
- GET/PATCH /tenants/:chatId/telegram-storefront
- POST /tenants/:chatId/telegram-storefront/verify

Publishing remains server-controlled: VERIFIED/PUBLISHED transitions require the verification boundary.

## Credential boundary
The browser accepts only secret:// credential references. Raw Telegram bot tokens are not stored in Sellify business persistence and are never returned by the seller API.

## Authority rules
Channel configuration does not own transactions, inventory, payments, fulfillment, identity, or event storage. The UI is a projection/editor over canonical server state.

## Evidence
Regression: phase0/fux-55-seller-storefront-channel-authority-regression.mjs.
GitHub Actions certification is pending until a workflow run for the resulting commit is observed.
