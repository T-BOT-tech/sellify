# SELLIFY TG-1 — Seller-Owned Telegram Storefront Foundation

**Status:** Implemented and regression-verified
**Source baseline:** R3 Release Readiness / Deployment Hardening snapshot, 2026-09-17

## Objective
Establish the first canonical persistence/API boundary for a seller-owned Telegram storefront without creating a second commerce, inventory, payment, fulfillment, event, or audit authority.

## Source inspection
Inspected the R3 source for:
- `app/src/platform/telegram.js`
- `app/store.js`
- `app/src/ui/settings.js`
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- existing identity/channel, authorization, catalog, marketplace checkout, audit, and migration infrastructure.

## Implemented
- Migration 39: `telegram_storefront_configs`, one configuration per canonical organization.
- Canonical storefront statuses: `DRAFT`, `CONFIGURED`, `VERIFIED`, `PUBLISHED`, `PAUSED`, `UNPUBLISHED`.
- Channel capabilities are configuration metadata, not authorities.
- Bot identity fields (`bot_id`, `bot_username`) and a `credential_ref` are stored; raw bot tokens are not stored.
- GET/PATCH `/tenants/:chatId/telegram-storefront` routes behind the existing tenant session and central authorization policy.
- Added `app/src/telegram-storefront-contract.js` documenting the channel boundary and allowed capabilities.
- Added TG-1 regression covering organization ownership, configuration persistence, status/capabilities, credential-reference semantics, and migration creation.
- Updated the current Phase 0 Golden Regression migration expectation from 38 to 39.

## Authority boundary
Telegram is an experience/distribution channel. Canonical Commerce, Inventory, Payment Core, Fulfillment, Logistics, Events and Audit remain authoritative.

`Seller Organization → Telegram Storefront Configuration → Telegram Experience → Existing Canonical APIs`

## Deliberately not changed
- No Telegram order database.
- No Telegram inventory authority.
- No Telegram payment ledger.
- No Telegram fulfillment or logistics engine.
- No Telegram event store.
- No raw bot token in business tables.
- No live BotFather/Telegram API verification yet; secure secret-provider capability is a prerequisite for true BYOB activation.
- No buyer storefront redesign yet (TG-3/TG-4).

## Verification
- `node phase0/tg1-telegram-storefront-regression.mjs` — PASS.
- `node phase0/golden-regression.mjs` — 21 PASS, 0 FAIL.
- Node runtime used: v22.16.0. Therefore the project's existing Node >=24 release-certification gate remains unresolved.

## Next
TG-2 — Bring Your Own Bot credential/verification boundary. It should integrate a secure secret provider rather than persisting raw Telegram bot tokens in SQLite.
