# Stall Ledger (Sellify)

Offline-first order-taking / POS app for sellers — market stalls, restaurants,
wholesale (B2B), and a small hybrid marketplace, all in one codebase behind a
niche/business-model switch. Everything is stored on-device (IndexedDB, with
a localStorage fallback); the only network call is a manual "Sync now" —
sellers can take orders all day with zero connectivity.

This file documents the current module layout after an 8-phase
modularization effort that turned a single `main.js` monolith into ~40
focused modules. The **inline comment at the top of each file** is still the
source of truth for *why* something lives where it does — this README is the
map that ties them together, since the comments themselves are scattered
across 40 files.

## Quick start

Static site, no build step. Serve the folder root and open `index.html`
(needs a real HTTP server, not `file://`, for ES modules and IndexedDB to
work — e.g. `python3 -m http.server`).

Copy `config.js.example` to `config.js` before deploying if you want a
default sync-server URL pre-filled (see comments in that file). `config.js`
is gitignored; the app works fine without it.

## Architecture in three rules

1. **`state.js` is the single source of truth** for state shared across more
   than one feature area (`config`, `products`, `orders`, `currentStaff`,
   etc.). Everything else either reads from there or owns state that's
   genuinely local to one feature (e.g. `searchQuery` in
   `products/search-filter.js`), exported with a setter the same way
   `state.js` exports setters for its own singletons.
2. **Each feature lives in its own top-level folder**, named after the
   feature, not the UI shape — `restaurant/`, not `tables-tab/`.
3. **`main.js` is bootstrap only.** It applies the theme, wires
   online/offline listeners, handles Telegram WebApp lifecycle and URL
   params, kicks off hydration/persistence/sync at startup — and otherwise
   just imports every feature module and re-exports their public API so
   `window-bridge.js` can flatten it onto `window` for the 75+ inline
   `onclick`/`onchange` attributes in `index.html`. No feature module
   imports `main.js` back (see [Phase 8](#phase-8-flatten-the-dependency-graph)).

## Module map

```
src/
├── main.js              bootstrap: theme, TWA lifecycle, URL params, boot sequence
├── window-bridge.js      flattens every feature module's public API onto `window`
├── state.js              single source of truth — app-wide shared state + setters
├── constants.js           pure static data (storage keys, IDB config, defaults)
│
├── utils/index.js         leaf helpers: uid, escapeHtml/Attr, capitalize, formatElapsed
│
├── i18n/
│   ├── translations.js     merges the per-locale files into TRANSLATIONS[lang][key]
│   └── locales/*.js        one file per language (en, es, sw, om, am, hi, so) — pure data
│
├── theme/branding.js       Theme controller: light/dark/sunlight + Telegram theme ingestion
│
├── auth/
│   ├── permissions.js       role → permission table (owner/manager/cashier/buyer)
│   └── pin.js                staff PIN modal, invite-code handling, role switch
│
├── config/
│   ├── currency.js           currency-symbol resolution (CS)
│   ├── niche.js               retail-niche presets + business-model taxonomy
│   └── payment-methods.js     Settings-tab CRUD over config.paymentMethods
│
├── storage/
│   ├── idb.js                 vanilla IndexedDB get/set/delete wrapper
│   ├── json.js                 loadJSON/saveJSON (writes through to IDB)
│   ├── migration.js            one-time localStorage → IndexedDB migration
│   ├── hydrate.js               boot-time hydration of state.js from IDB
│   └── persistence.js           persistent-storage request, quota display, data export
│
├── sync/
│   ├── index.js                syncNow() — the single "Sync now" entry point
│   ├── orders.js                 push queued orders to /sync/:chatId
│   └── catalog.js                 pull remote catalog/branding + trust-boundary sanitizers
│
├── products/
│   ├── catalog.js               product CRUD, edit-in-place, catalog tab
│   ├── render.js                  product grid/list rendering + price/stock badges
│   ├── search-filter.js           search box + category-pill filtering
│   ├── images.js                   image-preview modal, upload + compress
│   └── modifiers.js                restaurant-mode item modifiers / line notes
│
├── orders/
│   ├── cart.js                   in-progress cart, cash tendered/change, sticky bar
│   ├── checkout.js                order finalization (Telegram + local-queue paths)
│   ├── queue.js                    order-queue tab, daily summary, delete + undo
│   ├── receipts.js                 text/copy/share/print/canvas-image receipts
│   └── payment-proof.js             camera payment-proof capture + compression
│
├── restaurant/
│   ├── tables.js                 table CRUD, status cycling, transfer flow
│   └── kitchen.js                  kitchen ticket board, timers, mark-served + undo
│
├── b2b/
│   ├── accounts.js                wholesale account state + lookups
│   ├── pricing.js                   pricing tiers, volume discounts, effectiveUnitPrice()
│   └── ui.js                         account picker, Accounts tab, pricing settings UI
│
├── warehouse/
│   ├── inventory.js                stock tracking core (low/out-of-stock, applyStockChange)
│   ├── locations.js                 storage-location CRUD
│   └── ui.js                         Warehouse tab (4 sub-tabs) + adjust/receive modals
│
├── logistics/
│   ├── fulfillment.js              delivery/pickup status machine
│   └── ui.js                         Logistics tab + Order-tab fulfillment picker
│
├── platform/
│   ├── index.js                    public API: getActivePlatform(), initPlatform()
│   ├── registry.js                   tries each adapter's isActive() in priority order, caches the winner
│   ├── telegram.js                    the REAL adapter — Telegram Mini App integration
│   ├── whatsapp.js                    stub — isActive() always false
│   ├── sms.js                          stub — isActive() always false
│   ├── native.js                        stub — isActive() checks for Capacitor, false until it's added
│   └── web.js                            fallback — isActive() always true, submitOrder() always null
│
├── marketplace/
│   ├── listings.js                cached/fetched listings, search/filter, product grid
│   ├── cart.js                      marketplace cart + multi-vendor sticky bar
│   └── checkout.js                   multi-vendor checkout modal, 3 submit paths
│
└── ui/
    ├── i18n.js                    getLang/t/changeLanguage/updateI18n
    ├── toast.js                    toast + undo-toast helpers
    ├── render.js                    generic list DOM-patcher + renderAll() fan-out
    ├── branding.js                  remote-catalog branding engine (colors/logo/name)
    ├── tabs.js                      tab switching, "More" overflow sheet
    ├── settings.js                  niche/business-model switching, Settings modal
    └── modals.js                    Escape-key handler + modal focus trap (side-effect only)
```

## Dependency flow

```
index.html (onclick="...")
      │
      ▼
window-bridge.js  ──imports──▶  main.js
                                    │  (imports every feature module,
                                    │   re-exports for window-bridge.js)
                                    ▼
                    feature modules (orders/, products/, restaurant/,
                    b2b/, warehouse/, logistics/, marketplace/, sync/,
                    storage/, auth/, config/, platform/, ui/*)
                                    │
                                    ▼
                              state.js + constants.js + utils/
```

`main.js` imports **from** every feature module (to build the re-export list
`window-bridge.js` needs) but nothing imports `main.js` back — that
direction was closed in Phase 8. `window-bridge.js` is the only file that
imports `main.js`.

**One cycle remains, and it's expected:** `ui/render.js` is the render hub —
`renderAll()` dispatches into `products/catalog.js`, `orders/queue.js`,
`restaurant/*`, `b2b/ui.js`, `warehouse/ui.js`, `logistics/ui.js`, etc., and
several of those call back into `renderAll()`/`patchList()` after a save.
That's a real mutual dependency (a dispatcher calling feature renderers,
and feature renderers triggering re-renders), not leftover main.js debt —
untangling it would need an event-bus or callback-injection pattern, which
is a bigger architectural change than a cleanup. It works today because
every call happens inside a function body, never at module-init time, which
is all ES modules require of a cycle.

## Where do I add...

| Adding... | Goes in... |
|---|---|
| A new field on the product form | `products/catalog.js` (form) + `products/render.js` (display) |
| A new payment method type | `config/payment-methods.js` |
| A new report/receipt format | `orders/receipts.js` |
| A new fulfillment status | `logistics/fulfillment.js` |
| A new platform (e.g. a real WhatsApp/SMS/native implementation) | `platform/<name>.js`, following the interface every adapter implements (see that file's top-of-file comment) — then add it to `registry.js`'s priority list |
| A new language | `i18n/locales/<code>.js`, then register it in `i18n/translations.js` |
| A new role/permission | `auth/permissions.js` |
| Shared state used by 2+ features | `state.js`, following the `value` + `setValue()` pattern |
| State local to one feature | Own it in that feature's own file, exported with a setter (see `orders/cart.js`'s `currentTenderedAmount` for the pattern) |
| A helper with zero dependencies | `utils/index.js` |

## Phase history

The migration ran in 10 phases (0 is the bridge, 8 is the cleanup, 9 is the
platform-adapter extraction — no behavior changed in any phase, only file
locations):

| Phase | What moved |
|---|---|
| 0 | `window-bridge.js` created — every `main.js` function exposed on `window` |
| 1 | Leaf utilities, static constants, i18n data, Theme controller |
| 2 | `state.js` established as single source of truth; IndexedDB/migration/hydration/persistence extracted |
| 3 | Role permissions, staff PIN flow, niche/currency/payment-method config |
| 4 | Product catalog, cart/checkout/queue/receipts, payment-proof capture |
| 5 | Sync engine (`sync/*.js`) |
| 6 | Vertical features: `restaurant/`, `b2b/`, `warehouse/`, `logistics/`, `marketplace/` |
| 7 | The rest of `main.js`'s inline UI logic → `ui/*.js` (i18n helpers, render fan-out, branding, tabs, Settings modal, toasts) |
| 8 | Broke `main.js` ↔ feature-module import cycles — every feature file now imports shared helpers directly from their real owning module instead of back through `main.js` |
| 9 | Raw `window.Telegram.WebApp` checks scattered across `main.js`, `theme/branding.js`, `orders/checkout.js`, `orders/cart.js`, and `marketplace/checkout.js` → `platform/*.js`, behind a platform-adapter interface (Telegram is the only real adapter; WhatsApp/SMS/native/web are stubs) |

For the reasoning behind any specific extraction, the top-of-file comment
in that module is more detailed than this table — this README is the index,
not a replacement for them.
