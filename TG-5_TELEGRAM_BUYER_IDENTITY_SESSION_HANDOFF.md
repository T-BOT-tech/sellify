# TG-5 — Telegram Buyer Identity & Session Boundary

## Status
Implemented and regression-verified from the TG-4 source snapshot.

## Source-of-truth discipline
TG-5 inspected the existing Telegram storefront, TG-2 secure credential boundary, existing Telegram authentication, canonical Marketplace checkout, tenant isolation, and audit infrastructure before changes.

The existing global `TELEGRAM_BOT_TOKEN` remains dedicated to SELLIFY's existing Telegram authentication path. It is not reused for seller-owned storefront buyers.

## Implemented
- `app/src/platform/telegram-buyer-identity-contract.js`
  - server-side Telegram WebApp `initData` verification using the seller-owned bot credential resolved through TG-2
  - auth-date freshness validation
  - signature validation with timing-safe comparison
  - normalized buyer identity context
  - stateless buyer-session semantics; no new session table
  - fail-closed credential-provider behavior
- `app/src/platform/telegram-bot-credential-contract.js`
  - exposed transient credential resolution through the existing secure-provider boundary
  - raw token remains outside SQLite/business persistence
- `backend/server.js`
  - `POST /api/telegram-storefront/:chatId/buyer-session`
  - requires a published seller storefront
  - verifies buyer `initData` against that storefront's seller-owned bot credential
  - returns only verified buyer context and a stateless expiry
  - audits failed buyer verification using existing audit authority
  - Telegram checkout can carry the same `initData`; server re-verifies it before creating the canonical Marketplace order
  - checkout seller scope is checked against the published Telegram storefront
- `app/src/telegram-buyer-storefront.js`
  - exposes raw WebApp `initData` only to the frontend request boundary; it is never treated as verified client identity
- `app/store.js`
  - loads verified buyer context before Telegram storefront use
  - uses verified context for buyer display data
  - sends `initData` and storefront scope to canonical checkout for server-side verification
- `phase0/tg5-telegram-buyer-identity-regression.mjs`
  - valid signature verification
  - invalid signature rejection
  - freshness/normalization coverage
  - provider-unavailable fail-closed API behavior
  - checkout context completeness boundary
- npm script: `tg5:telegram-buyer-test`

## Security boundary
```text
Telegram WebApp initData
        ↓
Published Seller Storefront
        ↓
TG-2 Secure Credential Provider
        ↓
Seller Bot Secret (transient)
        ↓
Telegram initData HMAC verification
        ↓
Verified Buyer Context
        ↓
Canonical Marketplace Checkout
```

The buyer context is not a seller membership and does not create organization permissions. A Telegram buyer is not granted seller administration rights merely by possessing Telegram identity data.

## Deliberately not implemented
- no second identity authority
- no Telegram buyer session store
- no Telegram order store
- no Telegram customer database
- no Telegram payment ledger
- no Telegram inventory authority
- no direct client-trusted buyer identity
- no reuse of the global SELLIFY Telegram bot token for seller-owned bots
- no fake seller-bot credential provider

A real seller-owned Telegram buyer session requires the deployment-approved secure credential provider from TG-2. Without it, the endpoint returns a controlled 503 and does not authenticate the buyer.

## Verification
- `node phase0/tg5-telegram-buyer-identity-regression.mjs` — PASS
- `node phase0/tg4-telegram-buyer-storefront-regression.mjs` — PASS
- `node phase0/tg2-telegram-byob-regression.mjs` — PASS
- `node phase0/tg1-telegram-storefront-regression.mjs` — PASS
- `node phase0/golden-regression.mjs` — 21 PASS / 0 FAIL
- Node syntax checks — PASS

Runtime: Node v22.16.0. Node >=24 certification remains the existing release blocker.

## Next step
**TG-6 — Telegram storefront checkout/payment capability boundary and buyer order experience**, preserving Payment Core, Commerce Order, Inventory, Fulfillment and Logistics as canonical authorities.
