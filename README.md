# Sellify

Two parts, one deployment:

```
sellify/
├── app/       offline-first PWA (static files, no build step) — see app/README.md
├── backend/   multi-tenant sync backend (SQLite + zero npm deps) — see backend/server.js
├── package.json      root scripts, see below
└── .env.example       every environment variable, documented
```

## Deploying (production — one process, one command)

```
npm start
```

This runs `backend/server.js`, which:
- serves the API routes (`/sync/:chatId`, `/catalog/:chatId`, `/tenants*`)
- serves `app/` as static files for everything else (so the app and its
  sync backend are always same-origin — no CORS to configure, no
  `config.js` to hand-edit per deployment; see `handleConfigJs` in
  `backend/server.js`)
- reads all configuration from environment variables — see `.env.example`
  for the full list. At minimum, set `CORS_ALLOWED_ORIGINS` and
  `SELLIFY_DATA_DIR` before putting real sellers on it; the defaults are
  dev-friendly, not production-safe (the server warns at startup if
  `CORS_ALLOWED_ORIGINS` is unset).
- requires Node 24+ and uses the built-in `node:sqlite` module, so the
  deployment does not need native npm packages or a separate database server.

That's the whole deployable unit — no separate static host, no build step,
no `npm install` required (the backend has zero dependencies; `app/`'s only
`package.json` dependency, `serve`, is for local frontend-only dev, not
required in production).

## Local development

Two ways to work, depending on what you're changing:

**Working on the backend, or need the full app+sync flow:**
```
npm run dev:backend   # node --watch backend/server.js — serves app/ too
```
Open `http://localhost:8787` — this is the full app, same-origin sync
included, auto-restarting on backend changes.

**Working on the frontend only, don't need sync:**
```
npm run dev:app       # static file server, no backend, port 3000
```
The app works fully offline without a backend (that's the point — see
`app/README.md`); use this when you don't need to touch sync/catalog/tenant
behavior and want a faster edit loop than restarting a Node process.

## Operational hardening (Phase 5)

### SQLite migration, indexes, and audit trail

The backend now stores tenants, products, orders, phone routing, and audit
events in `SELLIFY_DB_PATH` (default `SELLIFY_DATA_DIR/sellify.sqlite`).
Startup applies schema migrations before serving requests. If the database has
not imported the legacy JSON files yet, the first startup imports them in one
transaction and leaves the original files untouched as a rollback source.

Marketplace stock decrement and seller sub-order creation now share one
SQLite transaction, so a crash cannot commit one without the other. Indexed
tenant/order/catalog queries replace whole-file scans, and seller owners can
read their own audit events from `GET /tenants/:chatId/audit` with the tenant
Bearer key.

Create a consistent rolling backup from the command line:

```
npm run backup
```

or call `POST /admin/backup` with `Authorization: Bearer <SELLIFY_BACKUP_TOKEN>`
after setting `SELLIFY_BACKUP_TOKEN` in the deployment secret manager. Backups
are written to `SELLIFY_BACKUP_DIR` and rotated according to
`SELLIFY_BACKUP_RETENTION`. Store that directory on a separate persistent
volume or copy it to independent object storage as part of the hosting
schedule.

### PWA updates and export safety

The service worker is network-first for same-origin app requests, retains a
previous shell for offline fallback, and prompts the user when a new worker is
ready. This avoids serving stale JavaScript after a deployment in a zero-build
PWA.

The browser's “Export my data” file is intentionally redacted: staff PINs,
the tenant sync API key, and payment-proof metadata/image references are
excluded. Server SQLite backups remain complete and must be protected like
production data.

## Data integrity in money and reporting (Phase 4)

Every monetary value in this app — product price, cart/order line price,
order total, cash tendered, change due — is now stored as an **integer
number of minor currency units** (cents/paise/kobo — `1999` instead of
`19.99`), never as a float. See `app/src/utils/money.js` for why: floats
can't represent most decimal amounts exactly, and that error compounds
across a cart with several line items, a tier-then-volume discount chain,
and a queue of thousands of orders. Only two kinds of place ever see a
major-unit decimal now: a form input the user is typing into, and a
display string — both convert at that boundary; every stored field and
every calculation in between stays integer.

- **Migration, not a breaking change.** Existing installs upgrade in
  place: `storage/migration.js`'s `migrateProductMoney`/`migrateOrderMoney`
  convert any legacy float price on load, marking each record
  (`_priceMinor`/`_moneyMinor`) so the conversion is idempotent and safe
  to re-run — deliberately per-record rather than behind one global
  "already migrated" flag, since IndexedDB and localStorage can each hold
  a different snapshot of this data depending on which one last wrote,
  and a single flag set after converting one of them could cause the
  other to be skipped. Runs once synchronously at boot (state.js) and
  again after IndexedDB hydration (storage/hydrate.js) in case that pulls
  in an older snapshot than what was already converted.
- **"Today's Sales" actually means today.** `renderDailySummary()`
  (orders/queue.js) used to sum every order ever stored in the local
  queue, with no date filter at all — confirmed as a real bug, not
  theoretical, on any install that had been running for more than a day.
  It now filters to orders created since local midnight before summing.
- **The backend recomputes order totals instead of trusting the client.**
  `saveQueuedOrders` (backend/lib/store.js) previously stored whatever
  `total`/item `price`/`qty` a synced order carried, unchecked. Every
  line item is now validated (price and qty must be finite, non-negative
  numbers) and the order's `total` is recomputed server-side as the sum
  of the validated items — a client sending a lying `total` field gets
  overridden, and an order with no valid items at all is rejected rather
  than silently stored as a $0 order that would throw off later
  reporting. This is deliberately *not* the same "price must match the
  seller's live catalog" rule `createMarketplaceOrder` already enforces
  (see Phase 2 below) — a POS order can legitimately be a custom quote, a
  B2B tier price, or a volume discount the backend has no record of, so
  there's no catalog price to check it against. What this closes is
  arithmetic tampering (items that don't add up to the claimed total),
  not price tampering, which isn't a meaningful attack on a seller's own
  device syncing to their own store. The client (`sync/orders.js`) marks
  a `rejected` order distinctly from a merely-still-queued one, so a
  malformed order doesn't retry forever.
- **Validated on the way in.** Product price entry (`addProduct`,
  `saveProductEdit` in products/catalog.js) now rejects non-finite values
  (`Number.isFinite`, not a bare `isNaN` — the old check let `Infinity`
  through) in addition to negative ones. Prices arriving from a synced
  catalog or marketplace feed (`sync/catalog.js`'s sanitizers) are coerced
  to a non-negative integer for the same reason — a stale pre-migration
  client or a hand-edited JSON file shouldn't be able to introduce
  fractional-minor-unit drift into local arithmetic.

**What this doesn't (yet) do.** Existing local currency displays
(`formatMoney`) always show two decimal places now, which is a visible
formatting change from the old ad-hoc mix of `toFixed(0)`s and bare
values — this is intentional (cent-level precision is the whole point),
not a regression. Recomputing POS-order totals server-side still trusts
the *price* the client sends per item, only re-derives the *total* from
those prices — closing that fully would mean the backend needs its own
notion of a device's current B2B/volume pricing, which is a bigger change
than this phase's scope (tracked for whenever staff get their own
server-side identity, per the Phase 3 section above).

## Real authorization, not UI-only (Phase 3)

`applyRolePermissions()` only ever hid or disabled controls — it never
stopped the underlying function from running. Any role could previously
call `removeProduct`, `deleteOrder`, edit/add a product, adjust or
receive stock, add/edit/remove a table, cycle a table's status, advance
or undo a kitchen ticket, or manage B2B accounts/pricing, just by
reaching the function another way (a modified client, or the browser
console). Every one of those mutation points now checks `hasPermission()`
itself, not just the UI that calls it:

- **Products/stock** — `saveProductEdit`/`addProduct` (`inventory:edit`/
  `inventory:add`), and `applyStockChange` in `warehouse/inventory.js`
  (`inventory:edit`) — gated once at the function that actually writes to
  `product.stock`, so both the "Adjust" and "Receive" modals in
  `warehouse/ui.js` are covered without duplicating the check per caller.
- **Tables/kitchen** — new `tables:manage` (add/edit/remove a table),
  `tables:status` (seat/free/transfer — day-to-day front-of-house work,
  so cashier keeps this one), and `kitchen:manage` (advance/undo a
  ticket's status or priority) permissions. `optimisticMarkServed` is
  gated directly, not just the `setKitchenStatus` wrapper that normally
  calls it, since a console call could reach it either way.
- **B2B** — new `b2b:manage` permission covers account CRUD, pricing
  tiers, and volume-discount tiers in `b2b/ui.js`.

**What this does and doesn't close.** The tenant backend now has a real
identity boundary for the first-party Telegram surface: Telegram `initData`
is verified server-side, users map to tenant memberships, and authenticated
devices receive revocable, tenant-scoped sessions. The browser is no longer
asked to create or paste a tenant-wide API key during new onboarding.
Legacy API keys remain in the database only for migration compatibility; new
authentication does not mint them. Staff PINs are still a local/offline
permission layer, not a substitute for server-side staff identity.

**PINs: removed the default credentials, hashed what's stored, and said what they are.**

- The old seed data shipped every fresh install with the same three PINs
  — 1234 (owner), 2222 (manager), 0000 (cashier) — and the "Invalid PIN"
  error in the pinModal spelled two of them out for anyone who mistyped.
  Fresh installs no longer seed any PIN at all; `ensureStaffPinsHashed()`
  (auth/pin.js, run once at boot after IndexedDB hydration) generates a
  random 4-digit PIN per seeded station and shows it once via a blocking
  alert — same "written down or it's gone" treatment the invite-code flow
  already used for stations created that way.
- PINs are stored as a salted SHA-256 hash (`pinHash`), not plain text.
  Any existing install with a plain-text `pin` field gets it hashed and
  the plain-text field deleted, the first time it boots post-upgrade.
  This closes plain-text exposure to anything that can read
  localStorage/IndexedDB (a synced backup, a shared device, a browser
  extension) — it does **not** make a 4-digit PIN resistant to brute
  force against a stolen hash; there are only 10,000 possible values.
  That's unavoidable at 4 digits and is exactly why PINs still aren't
  used as a credential for anything server-side.
- Deep-link staff invites (`JOIN_<role>_<name>`) can no longer create an
  **owner** station. A `JOIN_` link is just a URL — anyone who can guess
  or construct one gets whatever role it names, with no identity check —
  so minting a full-permissions owner account through it was a standing
  privilege-escalation path. Owner access on a new device now has to come
  from someone who already holds an owner PIN, set up in person; deep
  links requesting `owner` are silently downgraded to `manager`.
- UI copy no longer implies this is a login. The pinModal was titled "POS
  Station Access Lock" and talked about "authorizing station
  permissions"; it now says plainly that it switches which staff profile
  a shared device is using, and that anyone with the device can still
  reach the screen. Code comments (pin.js) say the same thing next to
  every place a PIN is checked or generated, so the local-convenience
  scope stays visible to the next person reading the code, not just to
  someone who happens to read this README section.

## Marketplace (Phase 2)

The cross-tenant marketplace the client already had UI for is now real,
not cached demo data:

- `GET /api/marketplace/search` — aggregates every seller's opted-in,
  in-stock products into one feed.
- `POST /api/marketplace/checkout` — validates against each seller's
  *current* server-side catalog (price and stock are never trusted from
  the client), decrements stock, and splits a multi-vendor cart into one
  sub-order per seller.

**Sellers opt in per product** — there's a "List on marketplace" checkbox
on each product in the Catalog tab. Nothing is exposed to the marketplace
by default; a synced catalog stays private until a seller explicitly
lists an item.

**Getting orders back to the seller.** Sync was previously push-only
(device → server), which meant an order created by `/api/marketplace/checkout`
had no way to reach the seller who needs to fulfill it. `GET /sync/:chatId`
(owner-key authenticated) now pulls any such order down on the next
"Sync now" — see `pullNewOrders` in `backend/lib/store.js`.

**A bug this surfaced and fixed:** Phase 1's backend auth mints an
`apiKey` on a tenant's first sync and requires it on every call after —
but the client never captured or sent it back. Left alone, every real
seller device would have been locked out of its own store after one
sync. Fixed in `app/src/sync/orders.js` and `app/src/sync/catalog.js`:
the key is now persisted to `config.apiKey` and sent as a Bearer token.

**Known limitation, deliberately not solved here:** the catalog-stock
decrement and the orders.json write for a marketplace checkout are two
separate locked operations, not one cross-file transaction — a crash
between them could in principle decrement stock without recording the
order. Real cross-file atomicity needs a real database, which is
Phase 5's job, not more flat-file machinery bolted on early.



Previously the ZIP (static PWA) and the backend (`server.js`, `lib/`,
`package.json`) were separate uploads with no single deploy path — deploying
the ZIP alone served the frontend only, and `app/config.js` shipped with an
empty sync URL that had to be hand-edited per environment. This structure
and the `/config.js`-generated-per-request change close both gaps: one repo,
one start command, and the sync URL resolves itself whenever backend and app
are deployed together (the normal case).

## Environment variables

See `.env.example` — every variable is documented there, not duplicated
here, so there's one place that can drift out of date instead of two.


## Phase 10.5 — Inventory Ledger

The current continuation adds an append-only `inventory_movements` ledger while
preserving the existing product stock projection and warehouse history.
Movement APIs are organization/location scoped and protected by central
authorization. Marketplace stock decrements are recorded atomically with their
SALE movement. See `phase10.5-INVENTORY-LEDGER.md`.


## Phase 10.7 — Compliance / Audit Hardening

The existing `audit_events` table remains the audit source of truth. Migration
11 adds actor, organization, location, device, reason, and result context,
plus indexes for audit history. Audit rows are protected as append-only at the
SQLite level.

Compliance controls are additive:

- organization-scoped audit retention policy metadata
- access/export/deletion request workflow
- organization/customer compliance export
- audit access/export history
- filtered audit inspection

See `phase10.7-COMPLIANCE-AUDIT.md`.

The implementation deliberately does not replace order/catalog sync or the
Phase 10.7 outbox/event channel.
