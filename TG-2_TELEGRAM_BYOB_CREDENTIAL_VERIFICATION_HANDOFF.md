# TG-2 — Telegram Seller-Owned BYOB Credential + Verification Boundary

## Status
Implemented and regression-verified on the TG-1 source snapshot.

## Source-of-truth discipline
TG-2 inspected the existing Telegram adapter, seller-owned storefront configuration, tenant authorization, audit infrastructure, and existing global `TELEGRAM_BOT_TOKEN` authentication path before changes.

The existing global `TELEGRAM_BOT_TOKEN` remains dedicated to Telegram WebApp buyer authentication. It is **not** repurposed for seller-owned bots.

## Implemented

- `app/src/platform/telegram-bot-credential-contract.js`
  - `secret://` credential-reference contract
  - no raw-token persistence
  - external secure credential-provider boundary
  - explicit provider registration API
  - fail-closed verification when no provider is configured
- `backend/lib/store-sqlite.js`
  - validates Telegram credential references
  - prevents direct transition into `VERIFIED`/`PUBLISHED` without the verification boundary
  - adds `verifyTelegramStorefront()` using the credential-provider contract
  - successful verification remains responsible only for channel identity/status metadata
  - failed verification is audited
- `backend/server.js`
  - `POST /tenants/:chatId/telegram-storefront/verify`
  - existing owner/manager authorization retained
  - credential reference is never returned as a secret
- `phase0/tg2-telegram-byob-regression.mjs`
  - credential-reference scheme validation
  - no-provider fail-closed behavior
  - no manual VERIFIED bypass
  - status remains CONFIGURED after blocked verification
- npm script: `tg2:telegram-byob-test`

## Deliberately not implemented

No raw Telegram bot token is accepted into or stored by SQLite. No fake verification is performed. No direct Telegram Bot API call was added to the business store or route layer.

A real BYOB activation requires a deployment-approved secure credential provider implementing the contract. That provider must retrieve the secret and perform Telegram bot identity verification through the controlled external-provider boundary.

## Boundary

`Seller Bot Token → Secure Credential Provider → credential_ref → Telegram verification adapter → verified bot identity`

The seller-owned storefront remains a channel/experience configuration. Commerce, inventory, payments, fulfillment, events, audit, and organization identity remain owned by their existing canonical authorities.

## Verification

- `node phase0/tg2-telegram-byob-regression.mjs` — PASS
- `node phase0/tg1-telegram-storefront-regression.mjs` — PASS
- `node phase0/golden-regression.mjs` — 21 PASS / 0 FAIL

Runtime used: Node v22.16.0. Node >=24 certification remains a separate existing release blocker.

The module-type and experimental SQLite warnings are existing/runtime warnings and did not produce test failures.

## Next step

**TG-3 — Seller Telegram Store Builder + lifecycle UX/API**, using the verified BYOB boundary and preserving canonical Commerce/Inventory/Payment/Fulfillment authorities.
