## Phase 14.12 — Ethiopia Integration

Status: COMPLETE / verified under Node 22.16.0.

Implemented `app/src/country-event-integration.js` as a country event adapter over the canonical versioned event boundary and existing outbox/backend consumer. Ethiopia contributes `country_code: ET` metadata only. Unsupported countries and unsupported backend event types fail closed. No country event store, broker, consumer registry, or domain authority was introduced.

Regression: `phase0/phase14.12-ethiopia-integration-regression.mjs`.

Node >=24 certification remains pending because the available runtime is Node 22.16.0. Phase 14.0 cumulative baseline re-lock also remains pending.

# SELLIFY --- AI DEVELOPMENT HANDOFF

## 0. Purpose

This document is the continuation contract for AI coding agents working
on Sellify.

**Read this file first, then inspect the supplied source ZIP.**

The current source of truth is:

`SELLIFY_PHASE10_4_CUSTOMER_DOMAIN.zip` (Phase 10.5 is the current working tree derived from it).

Do not reconstruct the project from conversation history when the source
code and this handoff document are available.

------------------------------------------------------------------------

# 1. PROJECT IDENTITY

**Project:** Sellify

**Current architectural direction:** Sellify is evolving from an
offline-first merchant/commerce application into a broader Commerce
Operating System and ultimately FLOWOS.

The long-term direction is:

> One interface for commerce everywhere.

The architecture must evolve safely from today's working Sellify
contracts rather than replacing them prematurely.

Core migration principle:

``` text
preserve → harden → canonicalize → connect → extract → compose → distribute → platformize
```

Non-negotiable engineering principle:

> Never sacrifice today's working Sellify to create tomorrow's
> architecture; make tomorrow's architecture emerge safely from today's
> working contracts.

------------------------------------------------------------------------

# 2. CURRENT SOURCE OF TRUTH

The latest completed implementation before the current continuation is **Phase 10.4 --- Customer Domain**. The current working continuation is **Phase 10.6 --- Multi-Location Inventory**.

The current ZIP contains:

``` text
sellify/
├── app/                  # offline-first static PWA
├── backend/              # Node + SQLite backend
├── phase0/               # baseline and regression controls
├── phase10.2-ORGANIZATION-LOCATION.md
├── scripts/
└── package.json
```

The backend is intentionally lightweight and currently has zero runtime
npm dependencies.

The project declares:

``` text
Node >=24
```

Do not lower this requirement merely because an inspection environment
happens to run an older Node version.

------------------------------------------------------------------------

# 3. CURRENT IMPLEMENTATION STATUS

## Phase 0 --- Baseline & Engineering Control

**Status: implemented**

Completed:

-   source baseline identification
-   architecture inventory
-   schema/API/module inventory
-   JavaScript syntax baseline
-   golden regression suite
-   tenant-isolation regression
-   marketplace integrity regression
-   migration idempotency verification
-   automated SQLite backup/restore integrity test
-   release-control scripts
-   source hashing / baseline artifacts

Remaining operational gates:

-   production execution on Node 24+
-   Git repository provenance/tag
-   real production backup/restore rehearsal

The automated baseline/regression work is not permission to skip
production verification.

## Phase 10.1 --- Canonical Identity Foundation

**Status: implemented**

Canonical structures introduced additively:

``` text
Organization
    ↓
Location
    ↓
User / Membership / Channel Identity / Device / Session
```

The implementation preserves existing Phase 6 identity concepts.

Existing:

-   `tenants`
-   `users`
-   `memberships`
-   `devices`
-   `sessions`
-   Telegram `chat_id`

must not be deleted or replaced simply because the new architecture uses
different canonical names.

Each existing tenant receives a canonical organization/default
location/channel mapping.

Legacy tenant-scoped behavior remains compatible.

## Phase 10.2 --- Organization & Location Foundation

**Status: implemented**

Canonical location types:

``` text
STORE
WAREHOUSE
COLLECTION_CENTER
DELIVERY_HUB
OFFICE
RESTAURANT
```

Location status:

``` text
active
inactive
```

Authenticated routes:

``` text
GET   /tenants/:chatId/locations
POST  /tenants/:chatId/locations
PATCH /tenants/:chatId/locations/:locationId
```

Current policy:

-   viewing: owner, manager, staff, cashier
-   creating/updating: owner or manager through the existing owner-role
    policy
-   broader centralized authorization is intentionally deferred to Phase
    10.3

Important:

**Inventory, order, catalog, and sync behavior has NOT yet been switched
to location-aware behavior.**

That belongs to later phases.

------------------------------------------------------------------------

# 4. NEXT TASK --- PHASE 10.3

## Central Authorization

The next implementation phase is:

**Phase 10.3 --- Central Authorization**

Target contract:

``` text
authorize(
  actor,
  organization,
  location,
  resource,
  action
)
→ ALLOW | DENY | REQUIRES_APPROVAL
```

Target roles:

``` text
Owner
Manager
Cashier
Staff
Buyer
Viewer
```

The authorization model must become centralized and server-enforced.

UI permission checks are presentation only.

Do not treat hidden/disabled UI controls as security.

Sensitive and denied operations should be auditable.

------------------------------------------------------------------------

# 5. PHASE 10.3 IMPLEMENTATION RULES

Before modifying code:

1.  Inspect the existing authentication/session/membership
    implementation.
2.  Identify every existing permission/role check.
3.  Identify which checks currently live in the client.
4.  Identify which checks already exist on the server.
5.  Define one canonical authorization contract.
6.  Add the new authorization layer beside the existing behavior.
7.  Preserve compatibility with existing roles and sessions.
8.  Add regression tests before switching existing routes.
9.  Migrate route-by-route rather than rewriting authentication.
10. Only remove old checks after the canonical policy is proven
    equivalent or intentionally changed.

Do not create a second unrelated permission system.

Existing identity must remain the foundation:

``` text
Organization
→ Location
→ User
→ Membership
→ Channel Identity
→ Device / Session
```

------------------------------------------------------------------------

# 6. EXISTING SYSTEM ARCHITECTURE

``` text
                 SELLIFY
                    │
        ┌───────────┴───────────┐
        │                       │
     Browser                  Backend
        │                       │
   Static PWA                Node.js
        │                       │
 IndexedDB                SQLite / migrations
 localStorage                  │
 fallback                      │
        │                       │
        └──────── Sync ─────────┘
                    │
               Commerce domains
```

## Frontend

The PWA is static ES modules with no production build step.

Important areas include:

``` text
app/src/auth/
app/src/b2b/
app/src/config/
app/src/i18n/
app/src/logistics/
app/src/marketplace/
app/src/orders/
app/src/platform/
app/src/products/
app/src/restaurant/
app/src/storage/
app/src/sync/
app/src/theme/
app/src/ui/
app/src/utils/
app/src/warehouse/
app/src/state.js
app/src/main.js
app/src/window-bridge.js
```

`state.js` is the shared application state.

`main.js` is bootstrap-oriented.

`window-bridge.js` is the controlled bridge into the application.

Do not casually rewrite the PWA architecture.

## Backend

Primary backend files:

``` text
backend/server.js
backend/lib/store-sqlite.js
backend/backup.js
```

The server serves both API and static application in the production
deployment shape.

------------------------------------------------------------------------

# 7. CURRENT DATABASE MODEL

Existing schema domains include:

``` text
schema_migrations
metadata
tenants
catalog_products
orders
phone_routing
audit_events
users
memberships
devices
sessions
auth_challenges
pairing_challenges
invites
```

Phase 10.1/10.2 add canonical organization/location identity structures.

The existing migration chain must remain forward-only and repeat-safe.

Never edit historical migrations to make a new migration easier.

Use:

``` text
add migration
→ backfill
→ verify
→ compatibility bridge
→ switch reads/writes
→ deprecate
→ remove only when safe
```

------------------------------------------------------------------------

# 8. EXISTING API SURFACE

Known route groups include:

``` text
POST /auth/telegram
POST /auth/migrate-legacy
POST /auth/tenants
GET  /auth/tenants
POST /auth/select-tenant
POST /auth/logout
POST /auth/pairing
POST /auth/pair
POST /auth/invites
POST /auth/invites/revoke
POST /auth/accept-invite

GET  /tenants/:chatId/invites
GET  /tenants/:chatId/devices
POST /auth/devices/revoke

POST /sync/:chatId
GET  /sync/:chatId

GET  /orders/:chatId

GET  /catalog/:chatId
POST /catalog/:chatId

GET   /tenants
PATCH /tenants/:chatId
GET   /tenants/:chatId/audit

GET   /tenants/:chatId/locations
POST  /tenants/:chatId/locations
PATCH /tenants/:chatId/locations/:locationId

POST /admin/backup

GET   /api/marketplace/search
POST  /api/marketplace/checkout
GET   /api/marketplace/orders/:id
PATCH /api/marketplace/orders/status/:id

GET /health
GET /config.js

GET /store/:id
GET /track
```

Before adding or changing routes, inspect the actual current source.
This list is a navigation aid, not permission to assume implementation
details.

------------------------------------------------------------------------

# 9. EXISTING DOMAIN CAPABILITIES

Current source already contains concepts for:

-   products/catalog
-   orders
-   offline order queue
-   synchronization
-   marketplace
-   seller-order operations
-   B2B
-   warehouse
-   logistics
-   restaurant
-   payment proof/payment methods
-   localization
-   platform adapters
-   receipts
-   audit
-   backup/export

Do not rebuild these from zero.

The roadmap is an extraction/canonicalization roadmap, not a rewrite
mandate.

------------------------------------------------------------------------

# 10. IMPORTANT EXISTING CONTRACTS

## Offline-first

IndexedDB is the primary browser persistence layer.

localStorage remains a fallback/legacy migration path.

Do not remove offline behavior while introducing server-side canonical
domains.

## Money

The documented money model uses integer minor units.

Do not reintroduce floating-point monetary calculations.

## Sync

Existing push/pull synchronization works and must be preserved while the
architecture evolves toward:

``` text
Local Transaction
→ Outbox
→ Event
→ Sync
→ Server
→ Idempotent Transaction
→ ACK
```

Do not replace sync wholesale in one phase.

## Marketplace

Existing marketplace checkout is transaction-oriented.

Preserve atomic stock decrement and seller-order creation.

Future marketplace work should formalize:

``` text
MarketplaceOrder
→ SellerOrder[]
→ Fulfillment[]
→ Payment
→ Settlement
→ Delivery
```

Do not rebuild marketplace from scratch.

## Audit

Existing `audit_events` is real infrastructure.

Future canonical AuditEvent work must normalize/extend it rather than
blindly replace it.

------------------------------------------------------------------------

# 11. GOLDEN REGRESSION CONTRACT

Every architectural change must preserve these behaviors unless an
explicit migration says otherwise.

## Boot

-   static app serves
-   backend starts under supported runtime
-   `/health` works
-   migrations execute safely

## Identity

-   Telegram authentication
-   tenant selection
-   device pairing
-   session logout/revocation
-   invitations
-   tenant isolation

## Products / inventory

-   product creation/editing
-   price validation
-   no negative stock through supported paths
-   warehouse adjustment/receive flows

## Orders

-   offline order creation
-   queued orders
-   reconnect synchronization
-   server-side total recomputation
-   malformed-order rejection
-   order history

## Marketplace

-   catalog search
-   price/stock validation
-   atomic stock decrement
-   seller-order creation
-   tracking
-   authorized status updates

## B2B / verticals

-   B2B accounts/pricing
-   restaurant operations
-   warehouse locations
-   logistics fulfillment state

## Offline/PWA

-   IndexedDB
-   localStorage fallback
-   hydration
-   service worker
-   safe exports

## Data safety

-   repeat-safe migrations
-   non-destructive legacy import
-   SQLite backups
-   append-oriented audit events

------------------------------------------------------------------------

# 12. TESTING RULE

Every phase must add executable tests for the behavior it changes.

Preferred approach:

**zero-dependency Node test harness**, because the backend is
intentionally dependency-light.

Root commands:

``` text
npm run phase0:baseline
npm run phase0:test
npm run phase0:release-check
```

Do not remove the Phase 0 suite.

If a new test fails:

1.  determine whether the failure is a real regression;
2.  fix the implementation if appropriate;
3.  update the migration/contract if the behavior intentionally changes;
4.  never simply weaken the test to make the build green.

------------------------------------------------------------------------

# 13. RELEASE / RUNTIME RULES

The project requires:

``` text
Node >=24
```

An older local inspection environment must not cause the engine
requirement to be downgraded.

Production release gates include:

-   supported Node runtime
-   regression suite
-   migration verification
-   backup creation
-   backup restoration rehearsal
-   repository provenance/tagging
-   deployment smoke test

------------------------------------------------------------------------

# 14. MASTER ROADMAP

``` text
Phase 0
Baseline / Engineering Control
        ↓
Phase 10.1
Canonical Identity
        ↓
Phase 10.2
Organization / Location
        ↓
Phase 10.3
Central Authorization
        ↓
Phase 10.4
Customer
        ↓
Phase 10.5
Inventory Ledger
        ↓
Phase 10.6
Event / Outbox Sync
        ↓
Phase 10.7
Compliance / Audit
        ↓
Phase 11
Commerce Engine
        ↓
Phase 12
Physical Commerce
        ↓
Phase 13
Vertical Packs
        ↓
Phase 14
Country Packs
        ↓
Phase 15
Native Distribution
        ↓
Phase 16
Sellify Platform
        ↓
Phase 17
SDK / Developer Ecosystem / AI
```

The dependency principle is:

``` text
baseline
→ identity
→ organization/location
→ authorization
→ customer/inventory
→ event/outbox
→ audit
→ payments/B2B/marketplace
→ documents
→ fulfillment/logistics
→ verticals
→ country
→ native
→ platform/SDK
→ FLOWOS
```

Do not jump ahead simply because a later feature is attractive.

------------------------------------------------------------------------

# 15. FUTURE FLOWOS DIRECTION

The broader architecture is expected to separate:

## FLOWOS Kernel

Responsible for platform-level concerns such as:

-   identity
-   organizations
-   memberships
-   permissions
-   context
-   audit
-   events
-   sync
-   storage
-   workflow
-   rules
-   configuration
-   security

## Sellify Commerce Domain

Responsible for commerce-specific concepts such as:

-   products
-   customers
-   orders
-   inventory
-   payments
-   documents
-   fulfillment
-   commerce integrations

The kernel should not become a dumping ground for every commerce
concept.

Likewise, Commerce should not own every platform concern.

AI agents eventually interact through:

``` text
User
→ AI Agent
→ Commerce Intent
→ Orchestrator
→ Capability Check
→ Domain
→ Transaction
→ Audit / Event
```

AI must not receive unrestricted direct database access.

------------------------------------------------------------------------

# 16. ORCHESTRATION / ADAPTER PRINCIPLE

Existing commerce integration direction:

``` text
Commerce Intent
→ Orchestrator
→ Capability Check
→ Universal Contract
→ Adapter
→ External Provider
```

The base commerce adapter must remain small and stable.

Provider-specific business logic belongs in adapters, not the
orchestrator.

Future capabilities may include:

``` js
adapter.capabilities = {
  checkout: true,
  subscriptions: false,
  refunds: false,
  inventory: true,
};
```

------------------------------------------------------------------------

# 17. MIGRATION DISCIPLINE

For every architectural upgrade:

``` text
1. Inspect existing implementation
2. Identify existing behavior
3. Define canonical contract
4. Add schema/migration
5. Add compatibility bridge
6. Implement service
7. Dual-write where necessary
8. Reconcile
9. Test
10. Switch reads
11. Monitor
12. Deprecate
13. Remove only when safe
```

Never:

-   rewrite working systems for aesthetics
-   delete legacy identifiers prematurely
-   create duplicate identity systems
-   replace SQLite just because another database is fashionable
-   rebuild marketplace from zero
-   replace sync wholesale
-   make native apps before the domain contracts are stable
-   put provider logic in the orchestrator
-   put country-specific tax rules into Core
-   give AI unrestricted database access

------------------------------------------------------------------------

# 18. AI AGENT OPERATING PROCEDURE

When continuing this project, follow this order.

### Step 1 --- Read

Read:

``` text
SELLIFY_AI_HANDOFF.md
```

Then inspect:

``` text
phase0/BASELINE.md
phase0/ARCHITECTURE-INVENTORY.md
phase0/REGRESSION-SPEC.md
phase10.2-ORGANIZATION-LOCATION.md
README.md
```

### Step 2 --- Inspect actual code

Do not rely only on this document.

For the next phase, inspect:

``` text
backend/server.js
backend/lib/store-sqlite.js
backend/package.json
package.json
app/src/auth/*
app/src/state.js
app/src/warehouse/*
app/src/sync/*
```

as relevant.

### Step 3 --- Establish baseline

Run the existing regression suite before making changes.

### Step 4 --- Implement narrowly

Implement only the current phase unless a blocking defect is discovered.

### Step 5 --- Test

Run:

``` text
npm run phase0:test
```

and the relevant new tests.

### Step 6 --- Preserve compatibility

Confirm that existing Phase 6 behavior remains intact.

### Step 7 --- Package

Produce a new clearly named ZIP containing the complete current source
and updated control artifacts.

### Step 8 --- Report

The completion report must include:

``` text
What changed
What stayed unchanged
Migration added
API changes
Tests added
Regression result
Known gates
Next phase
```

Do not claim production readiness when a release gate remains
unresolved.

------------------------------------------------------------------------

# 19. CURRENT HANDOFF STATE

At handoff:

``` text
Current source:
SELLIFY_PHASE10_3_CENTRAL_AUTHORIZATION.zip

Current phase:
10.4 — Customer Domain

Next phase:
10.5 — Inventory Ledger

Regression:
19 PASS / 0 FAIL

Runtime requirement:
Node >=24

Known environment caveat:
The inspection environment previously used Node 22.16.0.
Do not lower the project requirement.

Phase 0:
Implemented in code; production runtime/provenance gates remain.

Identity:
Canonical foundation implemented additively.

Organization:
Canonical organization mapping implemented.

Location:
Canonical location types and CRUD implemented.

Existing Phase 6 systems:
Must remain compatible.
```

------------------------------------------------------------------------

# 20. DEFINITION OF DONE FOR PHASE 10.3

Do not mark Phase 10.3 complete until all of the following are true:

-   [ ] canonical authorization contract exists
-   [ ] organization-aware authorization exists
-   [ ] location-aware authorization exists
-   [ ] Owner role preserved
-   [ ] Manager role supported correctly
-   [ ] Cashier role defined
-   [ ] Staff role defined
-   [ ] Buyer role defined
-   [ ] Viewer role defined
-   [ ] server-side authorization enforced
-   [ ] UI checks remain presentation-only
-   [ ] denied sensitive actions are auditable
-   [ ] existing authentication/session behavior remains intact
-   [ ] existing tenant isolation remains intact
-   [ ] regression suite remains green
-   [ ] migration is repeat-safe
-   [ ] compatibility bridge is documented
-   [ ] no duplicate identity/permission system has been introduced

Only then proceed to Phase 10.4.

------------------------------------------------------------------------

# 21. FINAL INSTRUCTION TO THE NEXT AI

You are not starting a new project.

You are taking over an existing, working Sellify codebase.

**Do not redesign it from scratch.**

Start from the supplied Phase 10.2 ZIP.

Treat the existing implementation as valuable production behavior even
where its architecture is not yet canonical.

Make the new architecture emerge through controlled migrations,
compatibility bridges, tests, reconciliation, and gradual read/write
switching.

**Your immediate task is Phase 10.3 --- Central Authorization.**

Before coding, inspect the actual implementation and establish the
existing authorization behavior.

Then implement the smallest safe canonical authorization layer that can
become the foundation for Customer, Inventory Ledger, Outbox Sync,
Audit, Payments, Marketplace, and eventually FLOWOS.


------------------------------------------------------------------------

# 22. PHASE 10.4 COMPLETION

Phase 10.4 Customer Domain is implemented additively.

Completed:

- canonical organization-scoped customer table
- optional order-to-customer relational link
- customer list/search/create/update API
- central authorization integration
- local offline customer registry
- checkout customer persistence
- lightweight Customers UI
- existing audit pipeline integration
- migration 8 and idempotency coverage

The next implementation phase is **10.5 — Inventory Ledger**.

The same rule remains mandatory: preserve existing product stock and stock
transaction behavior while introducing the ledger incrementally.


------------------------------------------------------------------------

# 9. PHASE 10.5 — INVENTORY LEDGER

**Status: implemented**

Phase 10.5 introduces the canonical append-only `inventory_movements` stream
without replacing `product.stock`, `stockTransactions`, warehouse UI, or the
existing offline workflow.

Completed:

- migration 9
- organization/location-scoped inventory movement table
- unique `event_id` idempotency key
- opening-balance projection from existing tracked catalog stock
- authenticated inventory movement/list/balance APIs
- central authorization for inventory view/edit
- local `warehouse/ledger.js` compatibility layer
- existing `applyStockChange()` now emits canonical movements
- marketplace checkout records SALE movements atomically with stock decrement
- Phase 10.5 regression suite

The ledger is currently a migration target and audit stream, not yet the sole
source of truth for stock balances. This is intentional.

Next: **Phase 10.6 — Multi-Location Inventory**.


# Current continuation — Phase 10.7

Phase 10.6 is implemented additively. Canonical Organization → Location records
now drive inventory location selection. Receiving and adjustment movements carry
the canonical `locationId`; ledger balances can be filtered by location. Legacy
`warehouseLocations` remain storage-bin labels for compatibility and are not
reinterpreted as business locations. `product.stock` remains the compatibility
projection.

Phase 10.7 is implemented additively. A durable local `outboxEvents` collection
now persists offline customer and inventory events. `POST /events/:chatId`
accepts authenticated events and processes them idempotently through `sync_events`.
Existing order/catalog sync remains unchanged.

Next: **Phase 11 — Commerce Engine**, after the Phase 10 foundation exit gate is verified.


# Phase 10.7 Compliance / Audit Hardening — Current Continuation

**Status: implemented and hardened incrementally.**

The compliance boundary now includes controlled request lifecycle transitions and subject validation without replacing `audit_events`, the existing authorization layer, or the Phase 10.7 outbox/event channel.

Additional hardening completed:

- compliance requests are limited to canonical `organization` and `customer` subjects;
- customer requests require an existing customer belonging to the organization;
- organization requests cannot target another organization;
- request transitions are state-guarded:
  - `pending → approved | rejected | cancelled`
  - `approved → completed | cancelled`
  - terminal states cannot transition again;
- invalid transitions return a conflict instead of silently rewriting compliance history;
- organization exports include bounded audit history, retention policy, and compliance-request history;
- customer exports include bounded audit history for the customer;
- regression coverage verifies lifecycle and export integrity.

Audit records remain append-only. Retention policy remains metadata until a future controlled archival/purge mechanism is introduced. Deletion requests remain workflow records and do not automatically destroy customer data.

**Foundation exit target:** Identity → Organization/Location → Authorization → Customer → Inventory → Outbox/Event → Compliance/Audit.

Next architectural phase: **Phase 11 — Commerce Engine**.


# Current authoritative continuation — Phase 11.2 Payment Core

**Source of truth:** `SELLIFY_PHASE11_1_MONEY_CONTRACT_HARDENED.zip` plus the Phase 11.2 changes in this package.

**Current phase:** Phase 11.2 — Payment Core

**Migration:** 14

**Implemented:**
- canonical organization-scoped PaymentAccount
- canonical Payment record with explicit minor-unit amount and currency
- guarded payment state machine
- append-only payment ledger history
- reconciliation records and matched/mismatched reconciliation flow
- compatibility projection from existing synchronized order payment fields
- authenticated payment APIs using the central authorization layer
- Phase 11.2 regression suite

**Preserved:**
- existing checkout flow
- existing `payment_method_id` / `payment_method_name` fields
- existing cash tender/change behavior
- existing payment proof capture/storage
- existing order synchronization
- existing Phase 10 foundation and Phase 11.1 money contract

**Provider boundary:** Provider-specific integrations are not yet implemented. Telebirr, CBE, M-Pesa, SMS parsing, API verification, initiation, status polling, and refunds remain adapter work after the core contract is proven.

**Next controlled increment:** continue Payment Core toward provider/channel registry and real provider-neutral adapter contracts, while preserving the canonical payment/state/ledger/reconciliation boundary.

------------------------------------------------------------------------

# CURRENT AUTHORITATIVE STATE — PHASE 11.2 PAYMENT CORE

The historical sections above are preserved for migration history. The
current source of truth is the latest Phase 11.2 package.

Current source:

`SELLIFY_PHASE11_2_PAYMENT_CORE_HARDENED.zip`

Completed:

- Phase 11.1 Money Contract
- Phase 11.2 Payment Core
- Payment provider/channel boundary

Payment Core now contains canonical payment accounts, payments, state
transitions, append-only payment ledger entries and reconciliation records.

Provider boundary:

```text
Payment Core
    ↓
Provider Registry ──→ manual / telebirr / cbe / mpesa
    ↓
Channel Registry  ──→ manual / sms / api
```

No live third-party provider integration is claimed. Telebirr, CBE and
M-Pesa are explicit unconfigured adapter identities that fail closed until
real credentials/integration code is supplied.

Next controlled increment:

**Phase 11.3 — B2B Workflow**, beginning with inspection and canonicalization
of the existing B2B implementation, preserving the current customer/order
behavior and following the roadmap sequence:

```text
Custom Pricing
→ Quotes
→ PO Approval
→ Credit Terms
→ Accounts Receivable
→ Invoice
```

Do not begin provider network integration or B2B implementation by rewriting
existing payment/order behavior.


## CURRENT STATE — PHASE 11.3 B2B WORKFLOW

The current source includes Phase 11.3 Custom Pricing as the first controlled B2B workflow increment.

Canonical custom pricing is additive and extends the canonical Customer domain:

```text
Business Customer + Product
        ↓
Customer Pricing Rule
        ↓
Money (minor units + explicit currency)
```

Existing local B2B accounts, pricing tiers, volume discounts, and checkout behavior remain unchanged. The canonical custom-pricing API is not yet the checkout source of truth.

Migration: 14

Routes:
- GET /tenants/:chatId/b2b/pricing
- GET /tenants/:chatId/b2b/pricing/:pricingId
- POST /tenants/:chatId/b2b/pricing
- PATCH /tenants/:chatId/b2b/pricing/:pricingId

Next controlled increment: Quotes.

------------------------------------------------------------------------

# CURRENT STATE — PHASE 11.3 B2B QUOTES

Current source:
`SELLIFY_PHASE11_3_B2B_CUSTOM_PRICING_HARDENED` plus Phase 11.3 Quotes.

Implemented sequence:

```text
Money Contract
    ↓
Payment Core
    ↓
Provider / Channel Boundary
    ↓
B2B Custom Pricing
    ↓
B2B Quotes
```

Phase 11.3 Quotes is implemented additively with migration 15.

Canonical quote states:

```text
DRAFT → SENT → ACCEPTED
             ├→ REJECTED
             ├→ EXPIRED
             └→ CANCELLED
DRAFT → CANCELLED
```

Existing B2B accounts, pricing tiers, volume discounts, order creation, and payment proof behavior remain compatibility paths and have not been rewritten.

**Current Phase 11.3 status:** Custom Pricing, Quotes, and PO Approval are implemented additively.

PO Approval source-of-truth package:
`SELLIFY_PHASE11_3_B2B_PO_APPROVAL_HARDENED.zip`

Migration 16 adds canonical `purchase_orders` and `purchase_order_items`.
POs snapshot accepted quotes and use the state machine:
`DRAFT → SUBMITTED → APPROVED | REJECTED | CANCELLED`.
Buyer may create/submit but cannot approve; manager/owner may approve.
The existing Order system remains unchanged; PO-to-Order conversion is deferred.

**Next controlled increment:** Phase 11.3 — Credit Terms, after inspecting any existing credit/debt/payment-term concepts.

------------------------------------------------------------------------

# CURRENT AUTHORITATIVE STATE — PHASE 11.3 CREDIT TERMS

Current source:
`SELLIFY_PHASE11_3_B2B_CREDIT_TERMS_HARDENED.zip`

Phase completed:
**11.3 — Credit Terms**

Migration:
**17** — `customer_credit_terms`

Canonical B2B sequence now implemented:

```text
Custom Pricing
    ↓
Quotes
    ↓
PO Approval
    ↓
Credit Terms
    ↓
Accounts Receivable (next)
    ↓
Invoice
```

Credit Terms are additive and do not yet create receivables or change the existing Order/Payment paths.

Next controlled increment:
**Phase 11.3 — Accounts Receivable**

Before implementation, inspect existing balance/debt/due-date/payment-order behavior again and build the smallest additive AR ledger that consumes approved credit terms without rewriting Orders or Payments.


# CURRENT AUTHORITATIVE STATE — PHASE 11.3 ACCOUNTS RECEIVABLE

Current source: `SELLIFY_PHASE11_3_B2B_ACCOUNTS_RECEIVABLE_HARDENED.zip`

Phase 11.3 completed through:
- Custom Pricing
- Quotes
- PO Approval
- Credit Terms
- Accounts Receivable

Current canonical B2B sequence:
`Customer → Custom Pricing → Quote → PO Approval → Credit Terms → Accounts Receivable → Invoice`

Migration: 18

Accounts Receivable uses an append-oriented receivable ledger and verified/reconciled payment allocation. Existing Orders, Payments, Payment Core, Quotes, Purchase Orders, and Credit Terms remain compatibility-safe and are not rewritten.

Next controlled increment: Phase 11.3 Invoice. Before implementation, inspect existing receipt/document/proforma concepts and build Invoice as a document contract over the established receivable boundary rather than a second accounting engine.

------------------------------------------------------------------------

# CURRENT AUTHORITATIVE STATE — PHASE 11.3 INVOICE

The historical handoff sections above are preserved for continuity. The
latest authoritative continuation is:

```text
Current source:
SELLIFY_PHASE11_3_B2B_INVOICE_HARDENED.zip

Completed:
Phase 11.1 Money Contract
Phase 11.2 Payment Core
Phase 11.2 Provider / Channel Boundary
Phase 11.3 Custom Pricing
Phase 11.3 Quotes
Phase 11.3 PO Approval
Phase 11.3 Credit Terms
Phase 11.3 Accounts Receivable
Phase 11.3 Invoice

Current migration:
19

Next phase:
Phase 11.4 Marketplace Integrity
```

## Phase 11.3 Invoice contract

Canonical sequence:

```text
Customer
  ↓
Custom Pricing
  ↓
Quote
  ↓
PO Approval
  ↓
Credit Terms
  ↓
Accounts Receivable
  ↓
Invoice
```

Invoice is a document snapshot over one existing receivable. It does not
create a second receivable, payment ledger, or retail receipt system.

Existing retail receipt generation remains under:

```text
app/src/orders/receipts.js
```

Migration 19 adds:

```text
invoices
invoice_items
```

Invoice states:

```text
DRAFT → ISSUED → VOID
DRAFT → CANCELLED
```

API:

```text
GET   /tenants/:chatId/b2b/invoices
POST  /tenants/:chatId/b2b/invoices
GET   /tenants/:chatId/b2b/invoices/:invoiceId
PATCH /tenants/:chatId/b2b/invoices/:invoiceId
```

Permissions:

```text
b2b:invoice:view
b2b:invoice:create
b2b:invoice:manage
```

Money remains integer minor units with explicit currency.

## Regression status

```text
Phase 0 Golden                       20 PASS / 0 FAIL
Phase 10.3 Authorization             PASS
Phase 10.5 Inventory Ledger          PASS
Phase 10.6 Multi-Location            PASS
Phase 10.7 Outbox/Event              PASS
Phase 10.7 Compliance/Audit          PASS
Phase 11.1 Money                     PASS
Phase 11.2 Payment Core              PASS
Phase 11.2 Provider/Channel          PASS
Phase 11.3 Custom Pricing            PASS
Phase 11.3 Quotes                    PASS
Phase 11.3 PO Approval               PASS
Phase 11.3 Credit Terms              PASS
Phase 11.3 Accounts Receivable       PASS
Phase 11.3 Invoice                  PASS
```

## Next controlled increment

Phase 11.4 — Marketplace Integrity.

Before changing marketplace behavior, inspect the actual marketplace
checkout, seller-order, stock, tracking, and payment paths. Preserve the
existing atomic checkout behavior and add canonical MarketplaceOrder,
SellerOrder, fulfillment, payment allocation, settlement, refund, and
risk/idempotency boundaries incrementally.


# CURRENT AUTHORITATIVE STATE — PHASE 11.4 MARKETPLACE INTEGRITY

The historical handoff sections above are preserved for continuity. The
latest authoritative continuation is:

```text
Current source:
SELLIFY_PHASE11_4_MARKETPLACE_INTEGRITY.zip

Completed:
Phase 11.1 Money Contract
Phase 11.2 Payment Core
Phase 11.2 Provider / Channel Boundary
Phase 11.3 Custom Pricing
Phase 11.3 Quotes
Phase 11.3 PO Approval
Phase 11.3 Credit Terms
Phase 11.3 Accounts Receivable
Phase 11.3 Invoice
Phase 11.4 Marketplace Integrity

Current migration:
20

Next phase:
Phase 12 — Physical Commerce
```

## Phase 11.4 canonical boundary

```text
MarketplaceOrder
      ↓
SellerOrder[]
      ↓
Fulfillment[]
      ↓
Payment Allocation
      ↓
Settlement
      ↓
Delivery
```

The existing marketplace checkout remains the operational checkout path.
Phase 11.4 adds canonical boundaries around it rather than replacing it.

### Added controls

- `Idempotency-Key` checkout support with request-hash protection.
- Authenticated buyer/session identity capture when a valid session is supplied.
- Anonymous/public buyer compatibility is preserved.
- Active-order rate/risk limit per buyer identity.
- Canonical `marketplace_orders`.
- Canonical `marketplace_seller_orders`.
- Canonical `marketplace_fulfillments`.
- Canonical `marketplace_inventory_reservations`.
- Canonical `marketplace_payment_allocations`.
- Canonical `marketplace_settlements`.
- Canonical `marketplace_refunds`.
- Checkout idempotency records.
- Seller-level state-machine projection.
- Master marketplace status aggregation.
- Cancellation reservation release.
- Payment-to-seller allocation bridge.
- Verified/reconciled full payment moves settlement to `READY`.
- Cancellation reverses pending/ready settlement and creates a pending refund allocation when payment has been allocated.

### Inventory integrity

The existing transactional stock decrement is preserved. SQLite
`BEGIN IMMEDIATE` continues to serialize checkout mutations, preventing a
stock race from creating duplicate committed stock sales.

The new reservation records are canonical control/projection records around
the existing stock mutation. They do not introduce a second stock ledger.

### Payment integrity

The existing canonical Payment Core remains authoritative for payment state.
Marketplace payment allocation is a bridge from a seller order's existing
Payment record to the canonical MarketplaceOrder/SellerOrder boundary.

Provider-specific payment/refund execution remains outside Marketplace Core.

### Regression

New regression:

```text
phase0/phase11.4-marketplace-integrity-regression.mjs
```

New command:

```text
npm run phase11.4:marketplace-test
```

The Phase 0 golden regression migration expectation has been advanced from
19 to 20 and includes an idempotency replay assertion.

### Verification status

Static JavaScript syntax checks pass.

Full runtime regression was not executed in the available inspection
environment because it reports Node 22.16.0 while the project explicitly
requires Node >=24 and uses Node 24's built-in `node:sqlite`.

Do not lower the Node requirement to make the test run.

## Next controlled increment

Phase 12 — Physical Commerce.

Continue with the same discipline:

```text
inspect
→ define boundary
→ additive migration
→ compatibility bridge
→ executable regression
→ verify under Node >=24
→ package
```

Do not rewrite the marketplace checkout or introduce a second inventory,
payment, or fulfillment engine.

## Phase 13.11 completion control record

Phase 13.11.20 Hashes / Documentation and Phase 13.11.21 Snapshot / Exit are complete. The full Phase 13.11 chain is now exited as a controlled, reproducible architecture snapshot. The chain preserves the hub-and-contract architecture: vertical packs converge on canonical Core authorities rather than creating N×N point-to-point implementations.

The controlled Phase 13.11 sequence completed is:

```text
13.11.0 Baseline Re-Lock
→ 13.11.1 Authority Matrix
→ 13.11.2 Contract Boundaries
→ 13.11.3 Physical Commerce Spine
→ 13.11.4 Warehouse ↔ Inventory
→ 13.11.5 Restaurant ↔ Commerce/Inventory
→ 13.11.6 Agriculture ↔ Commerce/Inventory
→ 13.11.7 Agriculture ↔ Warehouse/Logistics
→ 13.11.8 Restaurant ↔ Warehouse/Logistics
→ 13.11.9 Unified Fulfillment
→ 13.11.10 Event Boundary
→ 13.11.11 Idempotency / Replay
→ 13.11.12 Failure Isolation
→ 13.11.13 Cancellation / Returns
→ 13.11.14 Authorization / Tenant Isolation
→ 13.11.15 Audit / Observability
→ 13.11.16 Adversarial Regression
→ 13.11.17 Architecture-Lint
→ 13.11.18 Integration Matrix
→ 13.11.19 Cumulative Gate
→ 13.11.20 Hashes / Documentation
→ 13.11.21 Snapshot / Exit — COMPLETE
```

Phase 13.11 introduced no duplicate Core authority, no new persistence authority, no event broker/store, no route or dispatch engine, and no cross-pack orchestrator.

The final reproducibility record is `phase0/PHASE13.11.21-SOURCE-HASHES.sha256`, with `phase0/phase13.11.21-snapshot-exit-regression.mjs` as the executable exit control. The final snapshot intentionally excludes its own manifest and the ZIP package from the hash set to avoid circular hashing.

**Phase 13.11 status: COMPLETE / EXITED.**

The next implementation must begin from this snapshot and follow the roadmap's next controlled phase. Do not reopen completed Phase 13.11 architecture decisions without an explicit new phase/control record.

Do not lower the Node >=24 requirement. The available environment remains Node 22.16.0, so this snapshot is source/control integrity evidence, not Node >=24 runtime certification.



# PHASE 13.12 CURRENT HANDOFF

## Phase 13.12.0 — Security Gate Baseline / Re-lock

**Status:** COMPLETE — 2026-09-08

Starting source:
`SELLIFY_PHASE13_11_21_SNAPSHOT_EXIT_2026-09-08.zip`

The Phase 13.12 security gate is explicitly scoped to enforcing and certifying
use of the existing Phase 10.3 central authorization authority. It does not
create a second authorization system and does not pull Phase 13.13 configuration
or Phase 13.14 event/outbox implementation forward.

Completed controls:
- Phase 13.12 security scope re-locked
- Phase 10.3 `authorize(actor, organization, location, resource, action)` confirmed as canonical
- existing tenant/org/location isolation confirmed
- existing audit authority confirmed
- Phase 13.11.21 exit continuity confirmed
- Phase 13.13 configuration boundary explicitly deferred
- Phase 13.14 event/outbox boundary explicitly deferred
- Phase 0 golden regression: 21 PASS / 0 FAIL
- Phase 13.12.0 baseline regression: PASS

Next subphase:
**13.12.1 — Authorization Authority Inventory**

Do not redesign or replace the Phase 10.3 authorization layer. Inspect and
map the actual existing authorization call paths before adding enforcement.

## Phase 13.12.1 — Authorization Authority Inventory

**Status:** COMPLETE — 2026-09-08

The actual Phase 13.11.21 source was inspected and the existing authorization
surface was inventoried before further security enforcement work.

Canonical authority remains:

```text
authorize(actor, organization, location, resource, action)
→ ALLOW | DENY | REQUIRES_APPROVAL
```

The inspected server currently contains **39** `requireAuthorization()` call
sites. Existing protected capability groups include Orders, Customers, B2B,
Inventory, Locations, Payments, Audit, Compliance and Marketplace order
operations.

Vertical pack findings:

- Agriculture: pack-level `permissions` metadata exists, but no vertical
  evaluator or authorization persistence exists.
- Restaurant: pack-level table/kitchen permission metadata exists, but no
  vertical evaluator or authorization persistence exists.
- Warehouse: pack-level inventory permission metadata exists, but no vertical
  evaluator or authorization persistence exists.
- Logistics: no pack-level permission metadata is declared and no vertical
  evaluator or authorization persistence exists.

These pack declarations remain metadata only. They are not a second policy
engine and must not become one.

Completed controls:
- one canonical authorization authority confirmed
- existing server authorization paths inventoried
- organization/location boundary preserved
- existing audit authority preserved
- vertical duplicate authorization persistence blocked
- vertical duplicate authorization evaluators blocked
- Phase 13.12.0 baseline regression: PASS
- Phase 13.12.1 authority inventory regression: PASS
- Phase 0 golden regression: 21 PASS / 0 FAIL

Deliberately not changed:
- `backend/lib/authorization.js`
- identity/session persistence
- tenant-isolation authority
- audit persistence authority
- vertical pack architecture
- Phase 13.13 configuration
- Phase 13.14 event/outbox

Next subphase:
**13.12.2 — Security Context Contract**

# PHASE 13.12.2 — SECURITY CONTEXT CONTRACT

**Status:** COMPLETE — 2026-09-08

Phase 13.12.2 formalized a persistence-neutral security context contract over
the existing authentication/session, organization/location, authorization and
audit authorities.

Added:
- `backend/lib/security-context.js`
- `phase0/PHASE13.12.2-SECURITY-CONTEXT-CONTRACT.md`
- `phase0/phase13.12.2-security-context-contract-regression.mjs`
- `test:phase13.12.2`

Canonical security fields:
- actorId
- sessionId
- deviceId
- role
- chatId
- organizationId
- locationId

Optional observability / transaction fields:
- requestId
- correlationId
- causationId
- eventId
- idempotencyKey
- externalSystem
- externalObjectId

The new module is contract-only. It does not authenticate, authorize, persist,
or mutate. The existing Phase 10.3 API remains unchanged:
`authorize(actor, organization, location, resource, action)`.

Completed controls:
- canonical authorization authority preserved
- existing session/membership/device identity authority preserved
- organization/location scope preserved
- security and observability context normalized
- missing actor/session/chat/organization context rejected by contract validation
- location can be explicitly required for location-scoped capabilities
- no duplicate authorization/identity/audit persistence introduced
- Phase 13.12.2 regression: PASS

Deliberately deferred:
- Phase 13.12.3 resource/action registry
- Phase 13.12.8 mutation enforcement gate
- Phase 13.13 pack configuration
- Phase 13.14 events/outbox

Next subphase:
**13.12.3 — Resource / Action Registry**

## Phase 13.12.3 — Resource / Action Registry

**Status:** COMPLETE — 2026-09-08

Phase 13.12.3 established a declarative resource/action vocabulary for the four
Phase 13 vertical packs without creating another authorization evaluator,
permission store, role store, or persistence authority.

Added:
- `backend/lib/resource-action-registry.js`
- `phase0/PHASE13.12.3-RESOURCE-ACTION-REGISTRY.md`
- `phase0/phase13.12.3-resource-action-registry-regression.mjs`
- `test:phase13.12.3`

The registry contains 42 entries:
- Agriculture: farm, plot, season, crop, harvest, commodity, collection_center, buyer
- Restaurant: table, kitchen, recipe, preparation
- Warehouse: storage, receiving, stock_adjustment
- Logistics: shipment, route, delivery, proof, return, courier

Existing central permission mappings are preserved where they already exist:
- Agriculture: `agriculture:view` / `agriculture:manage` metadata
- Restaurant: `tables:status`, `tables:manage`, `kitchen:manage`
- Warehouse: `inventory:view`, `inventory:add`, `inventory:edit`

Recipe/preparation and Logistics actions remain explicitly vocabulary-only
because no corresponding Phase 10.3 central permission currently exists. No
new permission policy was invented to make them appear authorized.

The registry does not call `authorize()` and does not replace it. Phase 10.3
`backend/lib/authorization.js` remains the only authorization evaluator.

Completed controls:
- resource/action vocabulary registered for all four vertical packs
- canonical Phase 10.3 authority preserved
- existing permission names preserved
- vocabulary-only actions explicitly marked policy-neutral
- no duplicate authorization evaluator/store introduced
- Phase 13.12.3 regression: PASS
- Phase 13.12.2 regression: PASS
- Phase 0 golden regression: 21 PASS / 0 FAIL

Deliberately deferred:
- Phase 13.12.4 cross-pack role matrix
- mutation enforcement
- approval boundary
- sensitive-action audit gate
- Phase 13.13 configuration
- Phase 13.14 events/outbox

Next subphase:
**13.12.4 — Cross-Pack Role Matrix**

## Phase 13.12.4 — Cross-Pack Role Matrix

**Status:** COMPLETE — 2026-09-08

Phase 13.12.4 produced a derived cross-pack role matrix for the six existing
Phase 10.3 roles across all 42 Phase 13.12.3 resource/action entries: **252
rows**. It does not create or mutate authorization policy.

Added:
- `backend/lib/cross-pack-role-matrix.js`
- `phase0/PHASE13.12.4-CROSS-PACK-ROLE-MATRIX.md`
- `phase0/phase13.12.4-cross-pack-role-matrix-regression.mjs`
- `phase0/PHASE13.12.4-SOURCE-HASHES.sha256`
- `test:phase13.12.4`

Roles preserved exactly:
- owner
- manager
- cashier
- staff
- buyer
- viewer

The matrix derives effective decisions from the existing Phase 10.3 policy.
It does not create a role table, permission table, evaluator, or persistence
authority. Organization scope remains required and location scope remains
validated through the existing authorization/tenant-isolation boundary.

Important authority finding preserved by the matrix: the existing `owner` role
has the central `*` wildcard, so vocabulary-only Agriculture/Logistics actions
are `ALLOW` for owner and `DENY` for non-owner roles. This is existing Phase
10.3 behavior, not a new vertical permission grant.

Completed controls:
- six existing roles represented across all 42 registry entries
- 252 matrix rows verified
- current central permission grants preserved exactly
- non-owner access was not broadened
- vocabulary-only actions preserve the existing owner wildcard boundary
- organization mismatch remains denied
- valid existing policy grants remain allowed
- no duplicate authorization authority introduced
- Phase 13.12.4 regression: PASS

Deliberately deferred:
- Phase 13.12.5 organization isolation gate
- Phase 13.12.6 location scope gate
- Phase 13.12.7 vertical capability authorization
- Phase 13.12.8 mutation enforcement gate
- Phase 13.13 configuration
- Phase 13.14 events/outbox

Next subphase:
**13.12.5 — Organization Isolation Gate**

## Phase 13.12.5 — Organization Isolation Gate

**Status:** COMPLETE — 2026-09-08

Phase 13.12.5 certified organization isolation for the Phase 13 vertical-pack
security vocabulary using only the existing tenant-isolation and Phase 10.3
authorization authorities.

Added:
- `phase0/PHASE13.12.5-ORGANIZATION-ISOLATION-GATE.md`
- `phase0/phase13.12.5-organization-isolation-gate-regression.mjs`
- `phase0/PHASE13.12.5-SOURCE-HASHES.sha256`
- `test:phase13.12.5`

Coverage:
- 6 existing Phase 10.3 roles
- 42 registered Phase 13 resource/actions
- 504 same-org/cross-org capability isolation checks
- malformed/missing organization checks
- tenant chat mismatch checks
- cross-organization location checks
- direct Phase 10.3 organization mismatch checks
- existing server tenant authorization boundary checks

Results:
- same-organization decisions preserve the Phase 13.12.4 role matrix
- cross-organization authorization is always `DENY`
- missing session organization is `DENY`
- missing tenant organization is `DENY`
- tenant chat mismatch is `DENY`
- cross-organization location is `DENY`
- canonical tenant authority remains `backend/lib/tenant-isolation.js`
- canonical authorization authority remains `backend/lib/authorization.js`
- no duplicate tenant/organization authorization authority introduced
- Phase 13.12.5 regression: PASS — 519 assertions / 0 FAIL
- Phase 13.12.4 regression: PASS
- Phase 13.12.3 regression: PASS
- Phase 13.12.2 regression: PASS
- Phase 13.12.1 regression: PASS
- Phase 13.12.0 regression: PASS
- Phase 0 golden regression: 21 PASS / 0 FAIL

Deliberately deferred:
- Phase 13.12.6 location scope gate
- Phase 13.12.7 vertical capability authorization
- Phase 13.12.8 mutation enforcement
- Phase 13.12.9 approval boundary
- Phase 13.12.10 sensitive-action audit gate
- Phase 13.13 configuration
- Phase 13.14 events/outbox

Next subphase:
**13.12.6 — Location Scope Gate**

## Phase 13.12.6 — Location Scope Gate

**Status:** COMPLETE — 2026-09-08

Phase 13.12.6 certified the existing organization → location security boundary
without introducing a second location authority or changing Phase 10.3 policy.

Added:
- `phase0/PHASE13.12.6-LOCATION-SCOPE-GATE.md`
- `phase0/phase13.12.6-location-scope-gate-regression.mjs`
- `phase0/PHASE13.12.6-SOURCE-HASHES.sha256`
- `test:phase13.12.6`

Key finding preserved deliberately: `session.locationId` is currently the
existing/default location context. The source has no user-to-location
membership/assignment authority, so Phase 13.12.6 does not invent one or turn
that context field into a hard per-user location ACL.

Coverage:
- 6 existing roles
- 42 Phase 13 resource/action capabilities
- 504 same-org/foreign-location scope checks
- malformed location ownership checks
- canonical `authorize()` location checks
- server-side `assertLocationScope()` enforcement checks
- inventory location-scoped route checks
- canonical `locations.organization_id` ownership checks
- duplicate location-scope authority checks

Results:
- same-organization location scope: ALLOW
- foreign-organization location scope: DENY
- malformed location scope: DENY
- canonical Phase 10.3 authorization preserved
- existing session/default-location semantics preserved
- no location membership/scope persistence introduced
- Phase 13.12.6 regression: PASS
- Phase 13.12.5 regression: PASS
- Phase 0 golden regression: PASS

Deliberately deferred:
- Phase 13.12.7 vertical capability authorization
- Phase 13.12.8 mutation enforcement
- Phase 13.12.9 approval boundary
- Phase 13.12.10 sensitive-action audit gate
- Phase 13.12.11 API boundary attack tests
- Phase 13.13 configuration
- Phase 13.14 events/outbox

Next subphase:
**13.12.7 — Vertical Capability Authorization**

# Phase 13.12.7 — Vertical Capability Authorization

Status: implemented and regression-verified.

The vertical capability enforcement adapter is `backend/lib/vertical-capability-authorization.js`. It reuses canonical tenant/location isolation, resolves capabilities through `backend/lib/resource-action-registry.js`, fails closed for registry entries without a central permission, and delegates defined policy to `backend/lib/authorization.js`. It does not create a second authorization, role, permission, membership, or persistence authority.

Next phase: Phase 13.12.8 — Mutation Enforcement Gate.


## Phase 13.12.8 — Mutation Enforcement Gate

**Status:** COMPLETE — 2026-09-08

Phase 13.12.8 establishes the server-side execution gate between vertical
capability authorization and state-changing mutation. It composes the existing
Phase 13.12.7 authorization adapter and permits an injected canonical mutation
capability to execute only after the final decision is `AUTHZ.ALLOW`.

Added:
- `backend/lib/vertical-mutation-enforcement.js`
- `phase0/PHASE13.12.8-MUTATION-ENFORCEMENT-GATE.md`
- `phase0/phase13.12.8-mutation-enforcement-gate-regression.mjs`
- `test:phase13.12.8`
- `phase0/PHASE13.12.8-SOURCE-HASHES.sha256`

Security invariants proven:
- tenant/location scope precedes mutation;
- vertical capability authorization precedes mutation;
- `ALLOW` executes the injected canonical mutation exactly once;
- `DENY` never executes the mutation;
- vocabulary-only capabilities fail closed before mutation;
- foreign organization/location cannot reach mutation;
- unknown capabilities fail closed;
- `REQUIRES_APPROVAL` is not executed before the Phase 13.12.9 approval boundary;
- vertical application modules remain persistence-neutral and delegate mutation
  to injected canonical capabilities;
- no vertical backend mutation routes exist at this baseline, so no route-level
  bypass was invented or silently permitted;
- no second authorization, mutation, approval, audit, event, or configuration
  authority was introduced.

Regression result:
- Phase 13.12.8 mutation enforcement regression: PASS — 12 assertions / 0 FAIL

Next subphase: **Phase 13.12.9 — Approval Boundary**.

Scope reminder:
- 13.12.9 owns approval enforcement only; it must not become a second
  authorization authority.
- 13.12.10 owns sensitive-action audit enforcement.
- 13.13 owns configuration.
- 13.14 owns events/outbox.

## Phase 13.12.9 — Approval Boundary

**Status:** COMPLETE — 2026-09-08

Phase 13.12.9 establishes the approval enforcement boundary without creating a
new approval authority. `backend/lib/vertical-approval-boundary.js` composes
the existing authorization and mutation gates. When the canonical decision is
`REQUIRES_APPROVAL`, mutation is blocked until persistence-neutral approval
evidence contains `status: APPROVED`, `approvedBy`, and `approvedAt`.

Added:
- `backend/lib/vertical-approval-boundary.js`
- `phase0/PHASE13.12.9-APPROVAL-BOUNDARY.md`
- `phase0/phase13.12.9-approval-boundary-regression.mjs`
- `test:phase13.12.9`
- `phase0/PHASE13.12.9-SOURCE-HASHES.sha256`

Security invariants proven:
- `REQUIRES_APPROVAL` cannot execute mutation without approval evidence;
- incomplete/rejected approval evidence fails closed;
- valid approval evidence does not bypass canonical authorization;
- normal `ALLOW` continues through the Phase 13.12.8 mutation gate;
- no approval store, evaluator, role store, permission store, audit store,
  event store, or configuration store was introduced;
- Phase 10.3 authorization remains unchanged;
- Phase 13.12.10 audit enforcement remains deferred;
- Phase 13.14 events/outbox remains deferred;
- Phase 13.13 configuration remains deferred.

Regression result:
- Phase 13.12.9 approval-boundary regression: PASS — 11 assertions / 0 FAIL

Next subphase: **Phase 13.12.10 — Sensitive-Action Audit Gate**.

## Phase 13.12.10 — Sensitive-Action Audit Gate

Phase 13.12.10 completed on 2026-09-08.

Added:
- `backend/lib/vertical-sensitive-audit-boundary.js`
- `phase0/PHASE13.12.10-SENSITIVE-ACTION-AUDIT-GATE.md`
- `phase0/phase13.12.10-sensitive-action-audit-gate-regression.mjs`
- `phase0/PHASE13.12.10-SOURCE-HASHES.sha256`
- `test:phase13.12.10`

Security boundary:
`Authorization / Approval / Mutation outcome → Sensitive-Action Audit Gate → existing audit boundary → existing audit_events / recordAuditEvent()`.

Current sensitive scope is limited to registered `manage` actions because these are the current mutation-capable vertical actions. `view` actions are not promoted to this mutation audit gate.

The new module is persistence-neutral and delegates to the existing `app/src/audit/audit-boundary.js` and its canonical `recordAuditEvent()` persistence capability. It does not create an audit store, event store, telemetry backend, logger authority, authorization policy, approval store, permission evaluator, or configuration authority.

Phase 13.12.10 regression: PASS — 11 assertions / 0 FAIL.
Phase 13.12.0 → 13.12.10 cumulative security chain: PASS.
Phase 0 Golden Regression: PASS — 21 PASS / 0 FAIL.

Next subphase: **Phase 13.12.11 — API Boundary Attack Tests**.

## Phase 13.12.11 — API Boundary Attack Tests

**Status:** COMPLETE — 2026-09-08

Phase 13.12.11 attacks the composed security boundary from the API/capability edge
without creating a second authorization system. It verifies missing/invalid
actors, tenant substitution, foreign locations, forged roles/permissions,
unknown/policy-neutral capabilities, mutation bypass, approval forgery, sensitive
audit bypass, direct vertical persistence attempts, mutating-route protection,
and duplicate security authorities.

Added:
- `phase0/PHASE13.12.11-API-BOUNDARY-ATTACK-TESTS.md`
- `phase0/phase13.12.11-api-boundary-attack-regression.mjs`
- `test:phase13.12.11`
- `phase0/PHASE13.12.11-SOURCE-HASHES.sha256`

Regression result:
- Phase 13.12.11 API boundary attack regression: PASS — 24 assertions / 0 FAIL
- Phase 13.12.0 → 13.12.11 cumulative security chain: PASS
- Phase 0 Golden Regression: PASS — 21 PASS / 0 FAIL

Security invariants proven:
- cross-tenant and foreign-location requests remain denied;
- forged role strings and permission/wildcard inputs do not broaden authority;
- unknown and policy-neutral vertical capabilities fail closed;
- mutation callbacks cannot execute after DENY or outside tenant scope;
- approval evidence cannot manufacture authorization;
- sensitive audit evidence remains under the existing audit authority;
- existing authenticated mutating routes retain their canonical authorization hooks;
- no second authorization evaluator/store or audit persistence authority exists;
- Phase 13.13 configuration and Phase 13.14 events/outbox remain deferred.

Next subphase: **Phase 13.12.12 — Cross-Pack Escalation Tests**.

## Phase 13.12.12 — Cross-Pack Escalation Tests

**Status:** COMPLETE — 2026-09-08

Phase 13.12.12 attacks privilege escalation between the Agriculture, Restaurant,
Warehouse, and Logistics pack boundaries. The test proves that a central
permission associated with one pack capability cannot be reused by changing the
pack id, resource, action, or vertical vocabulary.

Added:
- `phase0/PHASE13.12.12-CROSS-PACK-ESCALATION-TESTS.md`
- `phase0/phase13.12.12-cross-pack-escalation-regression.mjs`
- `test:phase13.12.12`
- `phase0/PHASE13.12.12-SOURCE-HASHES.sha256`

Important current-policy finding preserved by the tests:
- the existing Phase 10.3 central policy does not currently define
  `agriculture:view` / `agriculture:manage`, so those registered Agriculture
  capabilities remain DENY rather than causing a new permission to be invented;
- Restaurant table/kitchen and Warehouse inventory capabilities continue to use
  only their existing Phase 10.3 permission keys;
- Logistics has no central pack-specific permission, so its vocabulary remains
  fail-closed, including for the existing owner wildcard.

Regression result:
- Phase 13.12.12 Cross-Pack Escalation Regression: PASS — 17 assertions / 0 FAIL
- Phase 13.12.0 → 13.12.12 cumulative security chain: PASS
- Phase 0 Golden Regression: PASS — 21 PASS / 0 FAIL

Security invariants proven:
- pack-id substitution cannot reuse another pack capability;
- resource substitution cannot borrow another pack permission;
- action substitution cannot turn view authority into manage authority;
- cross-pack privilege cannot be manufactured from Agriculture/Restaurant/
  Warehouse permissions;
- Logistics policy-neutral capabilities remain DENY;
- tenant and location isolation remain canonical prerequisites;
- no pack-to-pack ACL, role store, permission store, API gateway, audit store,
  event store, configuration store, or second authorization evaluator was added.

## Phase 13.12.13 — Pack Configuration

**Status:** COMPLETE — 2026-09-09

Phase 13.12.13 formalizes configuration as a deterministic, persistence-neutral
vertical-pack boundary. Existing `app/src/state.js#config` and
`STORAGE_KEYS.config` remain the configuration authority and persistence
authority.

Added:
- `app/src/verticals/configuration.js`
- `phase0/PHASE13.12.13-PACK-CONFIGURATION.md`
- `phase0/phase13.12.13-pack-configuration-regression.mjs`
- `phase0/PHASE13.12.13-SOURCE-HASHES.sha256`
- `test:phase13.12.13`

Configuration precedence:
`defaults → existing_config → organization_override → location_override → runtime_override`.

Current activation semantics are preserved:
- Agriculture remains declarative-only; no new feature switch is invented.
- Restaurant follows the existing `config.businessModel === 'restaurant'` rule.
- Warehouse follows `config.warehouseEnabled` with the existing false default.
- Logistics follows `config.logisticsEnabled` with the existing false default.

Security/configuration boundary:
- unknown packs fail closed;
- organization/location override scope mismatches are rejected;
- only supported configuration keys are composed;
- configuration does not grant authorization and does not bypass Phase 13.12
  security gates;
- no configuration persistence, role store, permission store, authorization
  evaluator, audit store, event store, or outbox was introduced.

Regression result:
- Phase 13.12.13 Pack Configuration Regression: PASS
- Phase 13.12.0 → 13.12.13 cumulative security chain: PASS
- Phase 0 Golden Regression: PASS — 21 PASS / 0 FAIL

Explicitly deferred:
- Phase 13.12.14 Events / Outbox Integration remains separate and is not pulled
  into this configuration increment.

Next subphase: **Phase 13.12.14 — Events / Outbox Integration**.

## Phase 13.12.14 — Events / Outbox Integration

**Status:** COMPLETE — 2026-09-09

Phase 13.12.14 connects vertical-pack event production to the existing versioned
`app/src/events/event-boundary.js` and existing durable
`app/src/sync/outbox.js#enqueueEvent` path without introducing a new event store,
broker, consumer registry, retry queue, or domain authority.

Added:
- `app/src/verticals/event-integration.js`
- `phase0/PHASE13.12.14-EVENTS-OUTBOX-INTEGRATION.md`
- `phase0/phase13.12.14-events-outbox-integration-regression.mjs`
- `test:phase13.12.14`

Current backend-supported event types remain only:
- `inventory.movement.record`
- `customer.upsert`

Unsupported vertical event types fail closed until a corresponding existing
backend consumer is implemented. This intentionally prevents logistics return,
restaurant, agriculture, or other new event types from entering the durable
outbox merely because an envelope can be constructed.

Regression result:
- Phase 13.12.14 Events / Outbox Integration Regression: PASS
- Four vertical pack boundaries: PASS
- Canonical versioned event envelope: PASS
- Existing outbox handoff: PASS
- Unsupported event types fail closed: PASS
- Existing backend consumer boundary preserved: PASS
- No duplicate event / broker / consumer authority: BLOCKED
- No event authorization evaluator introduced: BLOCKED

Explicitly not changed:
- `backend/lib/store-sqlite.js#processSyncEvent`
- existing `sync_events` persistence
- existing `app/src/sync/outbox.js` persistence
- Phase 13.12 authorization evaluator/boundary
- Phase 13.12.13 configuration authority
- existing domain mutation authorities

Next subphase: **Phase 13.12.15 — Phase 13 Regression Gate**.

## Phase 13.12.15 — Phase 13 Regression Gate

**Status:** COMPLETE — 2026-09-09

Phase 13.12.15 is the integrated regression/exit gate for the completed
13.12.0 → 13.12.14 security and composition chain. It certifies composition
without introducing a new authority.

Added:
- `phase0/PHASE13.12.15-REGRESSION-GATE.md`
- `phase0/phase13.12.15-phase13-regression-gate.mjs`
- `test:phase13.12.15`
- `phase0/PHASE13.12.15-SOURCE-HASHES.sha256`

Gate result:
- Phase 13.11.21 snapshot continuity: PASS
- Phase 13.12.0 → 13.12.14 control chain: PASS
- Canonical authorization / tenant / location / audit authorities preserved: PASS
- Vertical security gates compose without duplicate authority: PASS
- Pack configuration boundary preserved: PASS
- Event / outbox boundary preserved: PASS
- Cross-pack escalation boundary preserved: PASS
- Node `>=24` requirement preserved: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL
- Phase 13.12.15 exit certification: PASS

Historical baseline controls from 13.12.0–13.12.2 are retained unchanged. The
new gate evaluates the current architecture and therefore does not rewrite
historical assertions that configuration/event work was deferred at their
original control points.

Important runtime note: this gate verifies the required Node engine declaration
but does not certify execution on Node >=24. Runtime certification remains
Phase 13.16. The current environment is Node 22.16.0.

**Phase 13.12 security gate chain is now COMPLETE through 13.12.15.**

Next subphase: **Phase 13.12.16 — Node >=24 Full Regression**.

## Phase 13.12.16 — Node >=24 Full Regression

**Status:** BLOCKED — runtime certification pending real Node >=24 execution

Phase 13.12.16 adds the runtime certification gate for the completed
13.12.0 → 13.12.15 chain. It verifies the `package.json` Node `>=24`
requirement and executes the completed regression chain as a compatibility
preflight. The available environment is Node 22.16.0, so the gate intentionally
returns BLOCKED rather than claiming Node >=24 certification.

Added:
- `phase0/PHASE13.12.16-NODE24-FULL-REGRESSION.md`
- `phase0/phase13.12.16-node24-full-regression.mjs`
- `test:phase13.12.16`

Certification rule:
- Node major <24: compatibility preflight may PASS, but certification is BLOCKED with exit code 2.
- Node major >=24: full regression may certify PASS.

No architecture or authority changes were introduced.

## Phase 13.12.17 — Hashes + Documentation + Source Snapshot

**Status:** PREPARED — FINAL EXIT BLOCKED PENDING PHASE 13.12.16 NODE >=24 CERTIFICATION

Phase 13.12.17 prepares the reproducible final security-gate snapshot, controlled SHA-256 manifest, and documentation continuity. It intentionally does not promote Phase 13 to DONE while the required Node >=24 runtime certification remains blocked.

Added:
- `phase0/PHASE13.12.17-HASHES-DOCUMENTATION-SOURCE-SNAPSHOT.md`
- `phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs`
- `phase0/PHASE13.12.17-SOURCE-HASHES.sha256`
- `test:phase13.12.17`

Result:
- 13.12.0 → 13.12.15 chain remains PASS
- 13.12.16 remains BLOCKED under Node 22.16.0
- 13.12.17 controlled hashes generated and verified
- Node `>=24` declaration preserved
- Historical baseline manifests left immutable
- Final Phase 13 exit remains BLOCKED until a real Node >=24 execution returns PASS

Promotion rule: run `npm run test:phase13.12.16` under Node >=24; after PASS, verify the 13.12.17 hash manifest and promote this prepared snapshot to the final Phase 13 exit snapshot.

## Phase 14.1 — Country Pack Contract
Status: COMPLETE
Established `app/src/country-pack-contract.js` as a declarative, persistence-neutral country localization contract. The contract covers country, currency, locale, languages, tax, documents, phone/address rules, payment providers, compliance, number formats and date formats. Ethiopia is represented as a contract-only seed using ET/ETB and en/am/om; Telebirr and CBE remain deferred provider candidates. No country-specific persistence or duplicate Core commerce, inventory, payment, identity, authorization, audit, or event authority was introduced.
Next: Phase 14.3 — Currency / Money Localization.

## Phase 14.2 — Ethiopia Pack Identity / Locale
- Added `app/src/ethiopia-country-identity.js` as a pure runtime country identity/locale projection.
- Canonical organization country/currency/timezone remain authoritative; no country persistence or second identity store was introduced.
- Ethiopia maps to ET, preserves explicit organization currency, defaults timezone only when absent, and uses existing `en`, `am`, `om` i18n keys with `en` fallback.
- Existing `app/src/config/locale-defaults.js` remains a best-effort onboarding hint; `app/src/i18n/translations.js` remains the translation authority.
- Regression: `npm run test:phase14.2` PASS.
- Phase 14.0 cumulative artifacts remain a separate continuity item and are not claimed present unless re-added to the current source tree.

## Phase 14.3 — Currency / Money Localization
Status: COMPLETE
Added `app/src/country-money-localization.js` as a thin country-pack currency projection over the existing Core money and currency-symbol authorities. Ethiopia resolves to ETB with the existing `Br ` symbol and 2-decimal minor-unit scale. Existing `app/src/utils/money.js` remains authoritative for conversion/formatting and `app/src/constants.js` remains authoritative for symbols. No exchange-rate, tax, ledger, or country-specific money persistence authority was introduced. Regression: `npm run test:phase14.3` PASS.

## Phase 14.4 — Tax Boundary
- Completed as a boundary-only country-tax projection.
- Ethiopia remains `ET`, tax mode `country_defined`, implementation `deferred`.
- Added `app/src/country-tax-boundary.js`.
- No tax engine, tax ledger, invoice tax persistence, or country tax store introduced.
- Existing Commerce/B2B invoice, money, organization, authorization, audit, and event authorities remain canonical.
- Regression: `npm run test:phase14.4` PASS.

---

# PHASE 14.5 — DOCUMENT / INVOICE BOUNDARY

Status: COMPLETE — boundary-only implementation.

The existing B2B invoice authority remains canonical at `backend/lib/store-sqlite.js#invoices`, exposed through `backend/server.js#handleB2BInvoices` and consumed by `app/src/b2b/invoices.js`. Phase 14.5 adds `app/src/country-document-boundary.js` as a persistence-neutral Ethiopia document bridge.

The bridge does not own invoice persistence, invoice numbering, invoice status transitions, tax state, a document ledger, or a second invoice API. Ethiopia document rules remain `country_defined / deferred`; this phase does not claim legal/fiscal invoice compliance.

Regression command: `npm run test:phase14.5`.

# Phase 14.6 — Phone / Address Rules

Ethiopia phone/address behavior is a persistence-neutral boundary. Existing customer and organization identity remain authoritative. No address persistence, geocoding, map, or logistics engine is introduced.

# Phase 14.7 — Ethiopia Payment Adapter Mapping

Telebirr and CBE are mapped through the existing payment provider registry. Existing payment state, ledger, reconciliation, credentials, and provider execution remain authoritative. This phase is mapping-only; provider capabilities remain unconfigured/deferred and no country payment persistence or second payment authority is introduced.

# Phase 14.8 — Ethiopia Compliance Boundary

Status: COMPLETE — boundary-only implementation.

Added `app/src/country-compliance-boundary.js` to connect Ethiopia to the
existing Core compliance/audit capabilities without creating country-specific
compliance persistence or a second audit/compliance authority.

Existing authorities remain canonical:
- `audit_events` / `recordAuditEvent()` for audit history
- `audit_retention_policies` for retention policy state
- `compliance_requests` for access/export/deletion request lifecycle
- existing Core compliance export capability

Country-specific regulatory rules remain `country_defined_deferred`. This phase
does not claim Ethiopian legal/fiscal compliance and does not introduce a
regulatory-rule engine, country compliance ledger, second audit store, or new
compliance API.

Regression: `npm run test:phase14.8` PASS.

Next: Phase 14.9 — Country Configuration.

# Phase 14.9 — Country Configuration

Status: COMPLETE / verified under Node 22.16.0 inspection runtime.

Added `app/src/country-configuration.js` as a read-only composition boundary for the Phase 14 country-pack modules. It does not create country persistence, replace `state.js`, replace organization identity, or own tax/document/payment/compliance state.

Regression: `npm run test:phase14.9` PASS.

Phase 14.1–14.9 individual regressions: PASS.

Known gates remain unchanged: Phase 14.0 cumulative baseline re-lock is pending, and Node >=24 certification remains pending because the available inspection runtime is Node 22.16.0.

Next: Phase 14.10 — Country Security / Isolation.

# Phase 14.10 — Country Security / Isolation

Status: COMPLETE / verified under Node 22.16.0 inspection runtime.

Added `backend/lib/country-security-isolation.js` as a policy-composition
boundary. Country scope is subordinate to the existing tenant, organization,
location, and role authorization authorities. Matching country context never
grants a permission; the existing `authorize()` policy remains the final
authorization authority.

Fail-closed cases include missing tenant scope, foreign organization,
foreign location, missing country context, and country mismatch.

No country permission store, country membership store, country session
authority, country role matrix, or country authorization persistence was
introduced.

Regression: `npm run test:phase14.10` PASS.

Phase 14.1–14.10 individual regressions: PASS.

Known gates remain unchanged: Phase 14.0 cumulative baseline re-lock is
pending, and Node >=24 certification remains pending because the available
inspection runtime is Node 22.16.0.

Next: Phase 14.11 — Country Events / Outbox.

## Phase 14.13 — Cross-Country Regression

Phase 14.13 validates the cumulative Phase 14 country boundary chain and fail-closed behavior for unsupported countries. Ethiopia remains the only installed country pack (`ET`). Unsupported country codes do not silently fall back to Ethiopia or any other pack. Country configuration and country event integration fail closed for unsupported countries. Country packs remain non-authoritative for authorization, events, and payments.

Phase 14.0 baseline artifacts and Phase 14.11 regression artifacts were restored into the cumulative snapshot before the 14.13 gate because the Phase 14.12 ZIP did not contain those artifacts. Phase 14.0 regression PASS and Phase 14.11 regression PASS were re-run.

Node >=24 remains a release requirement. Runtime certification is not claimed while executing under Node 22.16.0.

## Phase 14.15 — Hashes + Final Snapshot (2026-09-09)
- Final snapshot prepared from the Phase 14.13 cumulative source.
- Phase 14.14 Node >=24 gate is explicitly BLOCKED in this environment because runtime is Node 22.16.0.
- Node engine declaration remains `>=24`; no downgrade was made.
- Snapshot is **prepared, not Node-24-certified**.

## Phase 15.0 — Country Pack Expansion Baseline Lock

Status: COMPLETE — baseline lock only.

Phase 15 starts from the exact Phase 14.15 prepared snapshot. No new country pack was introduced. Ethiopia (`ET`) remains the only installed country pack, unsupported country codes fail closed with `COUNTRY_PACK_UNKNOWN`, and the existing Core authority boundaries remain unchanged.

Added:
- `phase0/PHASE15.0-COUNTRY-PACK-EXPANSION-BASELINE.md`
- `phase0/phase15.0-country-pack-expansion-baseline-regression.mjs`
- `test:phase15.0` package script

Regression: `npm run test:phase15.0` PASS under the available Node 22.16.0 inspection runtime.

Node >=24 remains a release requirement. Phase 14.14 Node >=24 certification is not claimed.

Next: Phase 15.1 — Multi-Country Pack Contract Hardening.

## Phase 15.0 — Final Baseline Lock Result

The Phase 15.0 baseline regression passed against the Phase 14.15 prepared snapshot. The root project engine remains `>=24`; the available runtime remains Node 22.16.0, so this baseline does not certify Node >=24.

Baseline integrity checks:
- Phase 14.15 snapshot artifacts present: PASS
- Ethiopia-only country pack set: PASS
- Unsupported country fail-closed behavior: PASS
- Existing Phase 14.13 cumulative regression: PASS
- Phase 14.15 snapshot structure regression: PASS
- Core authority boundary unchanged: PASS by baseline preservation

Next: Phase 15.1 — Multi-Country Pack Contract Hardening.

## Phase 15.1 — Multi-Country Pack Contract Hardening

Status: COMPLETE / verified under Node 22.16.0 inspection runtime.

The stable country-pack contract remains version `1.0`; Phase 15.1 records
hardening revision `1.1` without breaking Phase 14 consumers. Validation is now
stricter for ISO country/currency shapes, locale/language shape, duplicate
languages/providers, and explicit country ownership claims for Core authorities.
`assertCountryPack()` fails closed with `COUNTRY_PACK_INVALID`.

No additional country pack was installed. Ethiopia (`ET`) remains the only
installed pack. Existing Core commerce, inventory, payment, identity,
authorization, audit, event, and persistence authorities remain canonical.

Regression: `node phase0/phase15.1-multi-country-pack-contract-regression.mjs` PASS.
Phase 14.1 contract regression PASS. Phase 14.13 cross-country regression PASS.

Node >=24 remains a project release requirement and is not certified by this
phase because the available inspection runtime is Node 22.16.0.

Next: Phase 15.2 — Kenya Country Pack Identity / Locale.

## Phase 15.2 — Kenya Country Pack Identity / Locale

Status: COMPLETE under Node 22.16.0; Node >=24 certification remains a separate pending gate.

Implemented additive Kenya country pack identity:
- countryCode: KE
- currency: KES
- locale: en-KE
- languages: en, sw
- timezone fallback: Africa/Nairobi
- payment provider identifier declaration: mpesa, deferred only

Added `app/src/kenya-country-identity.js` and Phase 15.2 regression/docs/hash manifest. No country persistence or duplicate Core authority was introduced.
Historical Phase 14/15.0 regressions that assert Ethiopia-only remain immutable historical baselines; Phase 15.2 supersedes that assumption with the additive multi-country baseline.

------------------------------------------------------------------------
# PHASE 15.4 — COUNTRY EXPANSION STRATEGY & REGIONAL MARKET ARCHITECTURE

**Status: IMPLEMENTED — strategy/architecture gate**

Phase 15.4 establishes a regional-first expansion strategy before additional country implementation.

Key decisions:
- EAC is the first regional architecture candidate.
- WAEMU/UEMOA is the second regional architecture candidate.
- CEMAC is the third regional architecture candidate.
- AfCFTA is a continental trade context, not a replacement authority.
- Country packs remain country overlays.
- Regional layers are declarative composition/adaptation layers only.
- No regional orders, inventory ledgers, payment ledgers, customer identity, fulfillment state, authorization store, audit store, event store/broker, tax ledger, or invoice authority may be introduced.

Weighted country-priority model:
- TAM / population: 20%
- Currency reuse: 15%
- Language reuse: 10%
- Regulatory / tax alignment: 25%
- Regional trade integration: 15%
- Payment ecosystem reuse: 10%
- Implementation complexity: 5%

Next phase:
**15.5 — Regional Cluster Contract**

The earlier provisional plan to implement the United Kingdom directly as Phase 15.4 and India as Phase 15.5 is superseded by this regional-first architecture sequence.

## Phase 15.5 — Regional Cluster Contract

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented `app/src/regional-cluster-contract.js` as a declarative regional composition boundary. The first installed regional cluster is EAC. It represents the current eight EAC Partner States and deliberately keeps currency country-specific. The contract records customs/common-market/tax/payment framework signals without creating regional persistence or Core authority.

Added:
- `app/src/regional-cluster-contract.js`
- `phase0/PHASE15.5-REGIONAL-CLUSTER-CONTRACT.md`
- `phase0/phase15.5-regional-cluster-contract-regression.mjs`
- `test:phase15.5`
- `phase0/PHASE15.5-SOURCE-HASHES.sha256`

Regression: `npm run test:phase15.5` PASS.

Authority boundary: regional clusters own no commerce, inventory, payments, identity, authorization, audit, events, tax ledger, invoice authority, or persistence. Country overlays remain mandatory.

Next: Phase 15.6 — Country Priority & Sequencing Gate.

## Phase 15.6 — Country Priority & Sequencing Gate

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented `app/src/country-priority-sequencing.js` as a strategy-only, non-persistent EAC country sequencing gate. It scores the seven currently unimplemented EAC Partner States after Kenya using the established weighted model and requires a manual activation gate before implementation.

Recommended order:
1. Tanzania (86/100)
2. Uganda (83/100)
3. Rwanda (74/100)
4. Burundi (56/100)
5. DRC (54/100)
6. Somalia (41/100)
7. South Sudan (40/100)

Scores are decision-support assessments, not legal/tax/payment claims. Country-specific evidence must be revalidated during implementation. No regional/country duplicate Core authority was introduced.

Added:
- `app/src/country-priority-sequencing.js`
- `phase0/PHASE15.6-COUNTRY-PRIORITY-SEQUENCING-GATE.md`
- `phase0/phase15.6-country-priority-sequencing-regression.mjs`
- `phase0/PHASE15.6-SOURCE-HASHES.sha256`
- `test:phase15.6`

Regression: `npm run test:phase15.6` PASS.

Next: Phase 15.7 — East Africa / EAC Expansion.


## Phase 15.7 — Tanzania Country Overlay / EAC Expansion

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented `app/src/tanzania-country-identity.js` as an additive Tanzania identity/locale bridge and extended `app/src/country-pack-contract.js` with the `TZ` / `TZS` country pack. Tanzania supports `en` / `sw`, uses `en-TZ`, and falls back to `Africa/Dar_es_Salaam` when organization timezone is absent. Payment providers remain an empty/deferred declaration because no Tanzania provider adapter was added to the existing provider registry in this phase.

Tanzania is already represented in the EAC regional cluster. No regional or country persistence, Core authority, payment ledger, identity store, tax ledger, invoice authority, or event store was introduced.

Added:
- `app/src/tanzania-country-identity.js`
- `phase0/PHASE15.7-TANZANIA-COUNTRY-OVERLAY.md`
- `phase0/phase15.7-tanzania-country-identity-regression.mjs`
- `phase0/PHASE15.7-SOURCE-HASHES.sha256`
- `test:phase15.7`

Regression: `npm run test:phase15.7` PASS.

Evidence used for country identity facts: Bank of Tanzania confirms Tanzanian Shilling/TZS; African Union identifies Tanzania and TZS; Tanzania Embassy country profile records ISO `TZ`, +255, UTC+3 and Swahili/English; current time-zone references identify `Africa/Dar_es_Salaam`.

Next: Phase 15.8 — WAEMU Regional Expansion.

## Phase 15.8 — WAEMU Regional Expansion

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented WAEMU/UEMOA as the second regional cluster in `app/src/regional-cluster-contract.js`.

WAEMU contract:
- region code: `WAEMU`
- members: `BJ`, `BF`, `CI`, `GW`, `ML`, `NE`, `SN`, `TG`
- shared language signal: `fr`
- common currency reference: `XOF`
- customs union: true
- common market: true
- country overlay required: true
- implementation status: `contract_only`

The contract remains persistence-free and cannot own commerce, inventory, payments, identity, authorization, audit, events, tax ledger, invoice authority, or any other Core authority. No WAEMU country overlay is activated by this phase.

Evidence: official UEMOA sources identify the eight member states, common CFA franc framework, common-market objectives, and common external tariff/customs framework.

Added:
- `phase0/PHASE15.8-WAEMU-REGIONAL-EXPANSION.md`
- `phase0/phase15.8-waemu-regional-expansion-regression.mjs`
- `phase0/PHASE15.8-SOURCE-HASHES.sha256`
- `test:phase15.8`

Regression: `npm run test:phase15.8` PASS when executed directly under Node 22.16.0.

Note: the historical Phase 15.5 regression intentionally remains immutable and expects only the EAC cluster; after additive WAEMU installation it is a historical stale-list test and is not rewritten. Current Phase 15.8 regression validates both EAC and WAEMU composition.

Next: Phase 15.9 — CEMAC Regional Expansion.

## Phase 15.9 — CEMAC Regional Expansion

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented CEMAC as the third regional cluster in `app/src/regional-cluster-contract.js`.

CEMAC contract:
- region code: `CEMAC`
- members: `CM`, `CF`, `TD`, `CG`, `GQ`, `GA`
- shared language signal: `fr`
- common currency reference: `XAF`
- customs union: true
- common market: true
- country overlay required: true
- implementation status: `contract_only`

The contract remains persistence-free and cannot own commerce, inventory, payments, identity, authorization, audit, events, tax ledger, invoice authority, or any other Core authority. No CEMAC country overlay is activated by this phase.

Evidence: official CEMAC and BEAC sources identify the six member states, the regional common-market mandate, and the six-state Central African monetary framework with XAF.

Added:
- `phase0/PHASE15.9-CEMAC-REGIONAL-EXPANSION.md`
- `phase0/phase15.9-cemac-regional-expansion-regression.mjs`
- `phase0/PHASE15.9-SOURCE-HASHES.sha256`
- `test:phase15.9`

Regression: `npm run test:phase15.9` PASS.

Historical Phase 15.5/15.8 membership-list tests remain immutable historical tests; current Phase 15.9 regression validates EAC, WAEMU, and CEMAC composition.

## Phase 15.10 — Other Strategic African Markets

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Implemented `app/src/strategic-market-contract.js` as a strategy-only candidate registry for Ghana and Zambia.

Candidates:
- Ghana: `GH`, `GHS`, Tier 1, `candidate_only`
- Zambia: `ZM`, `ZMW`, Tier 2, `candidate_only`

The registry is non-persistent, requires a future manual country-overlay gate, treats AfCFTA as contextual only, and cannot own commerce, inventory, payments, identity, authorization, audit, events, tax ledger, invoice authority, or persistence. Existing ET/KE/TZ/NG country packs and EAC/WAEMU/CEMAC regional clusters remain independent.

Added:
- `app/src/strategic-market-contract.js`
- `phase0/PHASE15.10-OTHER-STRATEGIC-AFRICAN-MARKETS.md`
- `phase0/phase15.10-strategic-african-markets-regression.mjs`
- `phase0/PHASE15.10-SOURCE-HASHES.sha256`
- `test:phase15.10`

Regression: `npm run test:phase15.10` PASS.

Next: Phase 15.11 — Currency / Money Expansion.

## Phase 15.11 — Currency / Money Expansion

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Added `app/src/currency-money-contract.js` as a declarative currency metadata registry. Expanded `app/src/constants.js` symbols and `app/src/utils/money.js` minor-unit scale support. Updated `app/src/country-money-localization.js` to consume the currency metadata contract while retaining `app/src/utils/money.js` as the canonical calculation authority.

Currencies covered: ETB, KES, TZS, NGN, GHS, ZMW, XOF, XAF, BIF, CDF, RWF, SOS, SSP, UGX.

Important compatibility boundary: existing XOF remains stored/calculated at the project's legacy 2-decimal scale. Canonical XOF decimal places are recorded as metadata only; no retroactive migration is performed.

No money ledger, FX engine, tax authority, payment authority, invoice authority, or persistence layer was introduced.

Regression: `npm run test:phase15.11` PASS.

Next: Phase 15.12 — Tax Boundary Expansion.

## Phase 15.12 — Tax Boundary Expansion
- Added `app/src/tax-boundary-expansion-contract.js`.
- Active country packs and strategic candidates receive declarative tax-boundary profiles only.
- EAC, WAEMU, and CEMAC are regional harmonization signals with mandatory country overlays.
- No tax calculation, rates, exemptions, thresholds, tax ledger, persistence, invoice-tax state, payment-tax state, or regional tax authority was introduced.
- Regression: `phase0/phase15.12-tax-boundary-expansion-regression.mjs`.
- Runtime remains Node 22.16.0; Node >=24 certification remains pending.

## Phase 15.13 — Document / Invoice Expansion

Status: COMPLETE under Node 22.16.0 inspection runtime; Node >=24 certification remains a separate release gate.

Added `app/src/document-invoice-expansion-contract.js` as a declarative document/invoice expansion registry for active countries, strategic candidates, and EAC/WAEMU/CEMAC regional signals.

Canonical authorities remain:
- Invoice persistence: `backend/lib/store-sqlite.js#invoices`
- Invoice API: `backend/server.js#handleB2BInvoices`
- Invoice numbering: existing B2B invoice authority
- Country document boundary: `app/src/country-document-boundary.js`

Kenya electronic-invoicing posture is recorded as external tax-authority-defined because KRA operates eTIMS. No eTIMS adapter or provider integration was implemented.

No invoice persistence, numbering service, document ledger, tax state, payment state, QR/signature authority, or regional invoice authority was introduced.

Added:
- `app/src/document-invoice-expansion-contract.js`
- `phase0/PHASE15.13-DOCUMENT-INVOICE-EXPANSION.md`
- `phase0/phase15.13-document-invoice-expansion-regression.mjs`
- `phase0/PHASE15.13-SOURCE-HASHES.sha256`
- `test:phase15.13`

Regression: `npm run test:phase15.13` PASS.

Next: Phase 15.14 — Phone / Address Expansion.

## Phase 15.14 — Phone / Address Expansion
- Expanded `app/src/country-phone-address-rules.js` from Ethiopia-only to active/candidate country overlays plus EAC/WAEMU/CEMAC member-country boundaries.
- Preserved Ethiopia's explicit `region → zone → woreda → kebele` hierarchy.
- Other countries remain `country_defined` for administrative hierarchy/postal behavior; no unsupported local validation rules were invented.
- E.164 is the representation boundary; persistence, identity, address ownership, and geocoding remain outside the module.
- Added `phase0/phase15.14-phone-address-expansion-regression.mjs` and `phase0/PHASE15.14-PHONE-ADDRESS-EXPANSION.md`.
- Next phase: 15.15 Payment Adapter Expansion.

## Phase 15.15 — Payment Adapter Expansion

Status: COMPLETE under Node 22.16.0; Node >=24 certification remains pending.

- Expanded `app/src/country-payment-adapter-mapping.js` from Ethiopia-only to ET/KE/TZ/NG plus GH/ZM candidate boundaries.
- Kenya and Tanzania map to the existing `mpesa` provider registry entry; provider implementation remains unconfigured/deferred.
- Nigeria, Ghana and Zambia remain provider-deferred; no unsupported provider was invented.
- Tanzania country pack payment provider declaration now references existing `mpesa` registry entry, preserving deferred implementation.
- No payment persistence, ledger, credentials, orchestration, settlement, FX, regional payment authority, or provider implementation was introduced.
- Added `phase0/phase15.15-payment-adapter-expansion-regression.mjs` and `phase0/PHASE15.15-PAYMENT-ADAPTER-EXPANSION.md`.
- Added `test:phase15.15` to `app/package.json`.
- Next: Phase 15.16 — Compliance Expansion.

## Phase 15.16 — Compliance Expansion

Status: COMPLETE under Node 22.16.0; Node >=24 certification remains pending.

Added `app/src/compliance-expansion-contract.js` as a declarative compliance expansion boundary.

Coverage:
- Active country overlays: ET, KE, TZ, NG.
- Strategic candidate boundaries: GH, ZM.
- Regional signals: EAC, WAEMU, CEMAC.
- Reuses existing Core compliance/audit authority for audit history, retention, compliance requests, and export.
- Adds contextual compliance signals for AML/CDD, beneficial ownership, sanctions screening, and anti-corruption without implementing legal rules or engines.
- No compliance persistence, second audit store, retention store, identity/KYC authority, AML engine, sanctions store, beneficial-ownership store, regulatory rules engine, tax/payment/invoice ledger, or event authority was introduced.

External standards were treated as context only: FATF risk-based CDD/beneficial ownership standards and the African Union anti-corruption convention inform the boundary but are not encoded as executable jurisdiction-specific rules.

Regression: `npm run test:phase15.16` PASS.

Next: Phase 15.17 — Country Security / Isolation Expansion.

## Phase 15.17 — Country Security / Isolation Expansion
- Added `backend/lib/country-security-expansion.js`.
- Country security remains subordinate to canonical tenant, organization, location, and authorization authorities.
- Active country packs: ET, KE, TZ, NG.
- Strategic candidates GH/ZM fail closed until manual country-pack activation.
- Regional EAC/WAEMU/CEMAC country members remain regional-country-boundary-only and fail closed until country overlays exist.
- No country permission/membership/session/identity/tenant/organization/location/audit/event store introduced.
- Regression: `phase0/phase15.17-country-security-expansion-regression.mjs` — PASS (47 assertions).

## Phase 15.18 — Country Events / Outbox Expansion

Status: COMPLETE under Node 22.16.0; Node >=24 certification remains pending.

Added `app/src/country-event-expansion.js` as a declarative country event/outbox expansion boundary. Active country packs are ET, KE, TZ, and NG. GH/ZM remain strategic candidates; other EAC/WAEMU/CEMAC members remain regional-country-boundary-only.

Country events reuse the canonical versioned event envelope, existing durable outbox, and existing backend consumer. Only existing backend event types `inventory.movement.record` and `customer.upsert` are executable. No country/regional event store, broker, event bus, consumer registry, duplicate outbox, or domain authority was introduced. Candidate and regional country event paths fail closed until country overlays are activated.

Regression: `npm run test:phase15.18` PASS.

Next: Phase 15.19 — Cross-Region Integration.

## Phase 15.19 — Cross-Region Integration

Status: COMPLETE under Node 22.16.0; Node >=24 certification remains pending.

Added `app/src/cross-region-integration-contract.js` as a composition-only boundary for country-to-country and regional-crossing flows.

- Active country packs: ET, KE, TZ, NG.
- Strategic candidates: GH, ZM; fail closed.
- EAC/WAEMU/CEMAC member countries without active country overlays remain regional-country-boundary-only.
- Regional discovery delegates to `app/src/regional-cluster-contract.js`.
- Country authority delegates to `app/src/country-pack-contract.js`.
- KE → TZ resolves within EAC without creating a regional transaction/store/ledger.
- ET → KE resolves as cross-region composition through country overlays and existing Core capabilities.
- Payment settlement remains the existing payment authority.
- Tax remains country-overlay only.
- Documents remain under the existing invoice authority.
- Events remain under the existing versioned event/outbox path.
- No regional transaction, regional ledger, cross-region settlement, commerce, inventory, payment, identity, authorization, audit, event, tax-ledger, invoice, or persistence authority was introduced.

Regression: `node phase0/phase15.19-cross-region-integration-regression.mjs` — PASS.

Next: Phase 15.20 — Cross-Country Regression Gate.

## Phase 15.20 — Cross-Country Regression Gate

Status: PASS under Node 22.16.0; Node >=24 certification remains pending.

Added `phase0/phase15.20-cross-country-regression-gate.mjs` and `phase0/PHASE15.20-CROSS-COUNTRY-REGRESSION-GATE.md`. The integrated gate validates active/candidate/regional country states, cross-region composition, canonical payment/event/security authorities, and the absence of duplicate regional persistence/authority. It records 126 golden assertions PASS / 0 FAIL.

Historical tests are not rewritten when an additive migration intentionally changes their expected state. The historical Phase 15.7 Tanzania regression remains stale because Tanzania's payment declaration was later mapped to the existing M-Pesa registry in Phase 15.15; the current integrated gate validates the current architecture instead.

Added `test:phase15.20` to `app/package.json`.

Next: Phase 15.21 — Node >=24 Full Regression.

## Phase 15.21 — Node >=24 Full Regression

Status: BLOCKED for Node >=24 certification under the available runtime; compatibility preflight PASS under Node 22.16.0.

Added `phase0/phase15.21-node24-full-regression.mjs`, `phase0/PHASE15.21-NODE24-FULL-REGRESSION.md`, and the Phase 15.21 source hash manifest. The gate verifies the immutable Node engine requirement `>=24`, runs the Phase 15.20 compatibility preflight, and refuses to promote a Node 22 result to Node >=24 certification.

Node >=24 certification remains an explicit release condition and must be rerun on a real Node >=24 runtime before Phase 15 can be declared fully certified.

## Phase 15.22 — Hashes + Final Snapshot

Status: PREPARED FINAL SNAPSHOT; Node >=24 certification remains BLOCKED.

The Phase 15 final snapshot preserves the complete cumulative source through Phase 15.21 and records the certification state without weakening the Node >=24 gate. The final snapshot is a release-candidate artifact, not a claim that Phase 15 is fully certified.

The snapshot includes the cumulative country/regional boundaries, payment/compliance/security/event/cross-region layers, integrated Phase 15.20 regression gate, and explicit Node >=24 gate. No historical regression is rewritten to hide additive architectural changes.

Final release conditions:
- Phase 15.20 integrated regression: PASS.
- Node >=24 full regression: BLOCKED until executed under real Node >=24 runtime.
- Phase 15.22 snapshot/hash integrity: PASS.
- No duplicate regional authority introduced.

Next release action: rerun `phase0/phase15.21-node24-full-regression.mjs` under Node >=24, then regenerate the final certification snapshot/hashes if and only if that gate passes.

## Phase 16.0 — Platform Baseline Lock

Status: IMPLEMENTED — baseline regression PASS under the available runtime; Node >=24 certification remains pending.

Phase 16 begins from the Phase 15.22 prepared final snapshot. Added `phase0/phase16.0-platform-baseline-regression.mjs` and `phase0/PHASE16.0-PLATFORM-BASELINE-LOCK.md`. The baseline locks canonical authority ownership, additive platformization, adapter boundaries, versioned event/outbox flow, AI capability boundaries, and the prohibition on new platform/regional persistence or domain authorities.

Regression: `npm run test:phase16.0`.

Next: Phase 16.1 — Canonical Capability Contracts.

## Phase 16.1 — Canonical Capability Contracts

Status: **PASS**.

Implemented the first executable platformization layer at `app/src/platform/capability-contract.js`. It defines a stable capability vocabulary over existing Sellify authorities and maps capability actions to the existing authorization vocabulary. It is delegation-only and owns no persistence, ledger, transaction engine, authorization authority, event store, broker, or API gateway.

Regression: Phase 16.1 = **30 PASS / 0 FAIL**; Phase 16.0 = **9 PASS / 0 FAIL**; Phase 15.20 = **126 PASS / 0 FAIL**.

Next: **Phase 16.2 — Authority Registry**. The next implementation must make authority ownership machine-verifiable while preserving all current authorities and without introducing a second store or permission system.

Node >=24 remains a certification gate; current runtime is Node 22.16.0.

## Phase 16.2 — Canonical Authority Registry

Status: PASS implementation; Node >=24 certification remains pending globally.

Added `app/src/platform/authority-registry.js` as a declarative, machine-verifiable map of the existing Commerce, Inventory, Payments, Customers, Locations, Fulfillment, Documents, Audit, Country, Vertical, and Events authorities. Added `phase0/phase16.2-authority-registry-regression.mjs` and `test:phase16.2`.

Architecture remains: Consumer → Capability Contract → Authority Registry → Existing Authority. No new persistence, database, ledger, authorization, transaction engine, API gateway, broker, or event store is introduced. Unknown authority/capability resolution fails closed.

Phase 16.2 regression: 30 PASS / 0 FAIL. Phase 16.1: 30 PASS / 0 FAIL. Phase 16.0: 9 PASS / 0 FAIL. Phase 15.20: 126 PASS / 0 FAIL.

# Phase 16.6 — Contract Versioning

Status: PASS.

Implemented `app/src/platform/contract-versioning.js` as a metadata-only compatibility layer for canonical platform contract versions. Versions support MAJOR.MINOR or MAJOR.MINOR.PATCH. Compatibility requires the same major version and a provider version at least as new as the consumer minimum. Breaking changes require a major version. No migration store, persistence, broker, transaction engine, or duplicate authority is introduced.

Regression: Phase 16.6 = 35 PASS / 0 FAIL. Phase 16.5 = 33 PASS / 0 FAIL. Phase 16.4 = 36 PASS / 0 FAIL. Phase 16.3 = 32 PASS / 0 FAIL. Phase 16.2 = 30 PASS / 0 FAIL. Phase 16.1 = 30 PASS / 0 FAIL. Phase 16.0 = 9 PASS / 0 FAIL. Phase 15.20 = 126 PASS / 0 FAIL.

Node >=24 certification remains pending because the current runtime is Node 22.16.0.

## Phase 16.7 — Event / Outbox Platformization

Status: PASS under Node 22.16.0; Node >=24 certification remains pending.

Added `app/src/platform/event-outbox-platform.js` as a platform composition boundary over the existing versioned event envelope, durable outbox, and backend sync consumer. Supported executable event types remain only the existing `inventory.movement.record` and `customer.upsert` consumers. No event broker, event store, consumer registry, duplicate outbox, or domain authority was introduced.

Regression: Phase 16.7 PASS. Phase 16.6: 35 PASS / 0 FAIL. Phase 16.5: 33 PASS / 0 FAIL. Phase 16.4: 36 PASS / 0 FAIL. Phase 16.3: 32 PASS / 0 FAIL. Phase 16.2: 30 PASS / 0 FAIL. Phase 16.1: 30 PASS / 0 FAIL. Phase 16.0: 9 PASS / 0 FAIL. Phase 15.20: 126 PASS / 0 FAIL.

## Phase 16.8 — External Integration Gateway

Status: PASS under Node 22.16.0; Node >=24 certification remains pending.

Added `app/src/platform/integration-gateway.js` as a controlled execution boundary for external consumers. The gateway validates integration status/direction/scope, declared operations, canonical capability actions, and delegates authorization to the existing authorization policy. Actual capability execution is dependency-injected and must remain an existing authority handler. Provider execution remains outside the gateway.

The gateway explicitly owns no database, persistence, credentials, token store, authorization store, transaction engine, ledger, event store, broker, API gateway, or domain authority. Unknown integrations, unsupported operations, missing scope, missing authorization, and missing handlers fail closed.

Added `phase0/phase16.8-integration-gateway-regression.mjs`, `phase0/PHASE16.8-EXTERNAL-INTEGRATION-GATEWAY.md`, and `test:phase16.8`.

Regression: **12 PASS / 0 FAIL**. Cumulative Phase 16.0–16.7 regressions and Phase 15.20 compatibility gate also PASS.

Next: **Phase 16.9 — Tenant / Country / Vertical Composition Boundary**.


## Phase 16.9 — Tenant / Country / Vertical Composition Boundary

Status: PASS under Node 22.16.0; Node >=24 certification remains pending globally.

Implemented `app/src/platform/tenant-country-vertical.js` as a composition-only boundary over existing tenant context, country-pack configuration, and vertical-pack configuration. It requires a tenant identifier, permits only active country packs (ET, KE, TZ, NG), and fails closed for strategic candidates, regional-only countries, unknown countries, duplicate verticals, and unknown vertical packs. Supported verticals remain agriculture, restaurant, warehouse, and logistics.

The module owns no persistence, mutation, identity, authorization, payment, inventory, commerce, invoice, audit, event, or transaction authority. Existing tenant/location isolation, country configuration, vertical configuration, central authorization, domain transaction, and outbox authorities remain canonical.

Regression: Phase 16.9 = **15 PASS / 0 FAIL**. Phase 16.8 = **12 PASS / 0 FAIL**. Phase 16.7 = PASS. Phase 16.6 = **35 PASS / 0 FAIL**. Phase 16.5 = **33 PASS / 0 FAIL**. Phase 16.4 = **36 PASS / 0 FAIL**. Phase 15.20 = **126 PASS / 0 FAIL**.

Next: **Phase 16.10 — AI Capability Boundary**.

## Phase 16.10 — AI Capability Boundary

Implemented `app/src/platform/ai-capability-boundary.js`. AI is restricted to structured intent resolution against canonical capabilities. Direct database/persistence/credentials/transaction/ledger/event-store/broker/direct-execution fields are rejected. Mutations are classified for the existing approval policy; no new AI execution or approval authority was created. Regression: 14 PASS / 0 FAIL. Node >=24 certification remains pending.

## Phase 16.11 — Platform Security

Status: **PASS — Node >=24 certification remains pending globally.**

Implemented `app/src/platform/platform-security.js` as the canonical security composition boundary for the Phase 16 platform surface. It validates the existing security context, resolves canonical capability/authority, composes tenant/country/vertical scope through existing boundaries, and delegates authorization to the existing authorization authority. It does not authenticate users, store identity, create a permission matrix, persist security state, or execute domain transactions.

Security flow:

Platform Consumer → Platform Security Boundary → Existing Tenant/Country/Vertical Boundaries → Existing Authorization → Existing Domain Authority.

The boundary fails closed for invalid security context, undeclared actions, inactive/candidate/regional country packs, cross-tenant scope, and forbidden authority/input fields. Credentials, secrets, database handles, persistence, ledgers, transaction engines, event stores and brokers are never owned or stored.

Regression: Phase 16.11 = **30 PASS / 0 FAIL**; Phase 15.20 compatibility = **126 PASS / 0 FAIL**.

Node >=24 remains blocked until a real Node >=24 runtime is available; current runtime is Node 22.16.0.

## Phase 16.12 — Platform Regression

Implemented `phase0/phase16.12-platform-regression.mjs` and `phase0/PHASE16.12-PLATFORM-REGRESSION.md`. This is a cumulative, non-destructive gate for Phase 16.0–16.11. It verifies the public platform boundary, checks that platform modules do not introduce duplicate persistence or domain authorities, executes all completed Phase 16 regression controls, and executes the existing Phase 0 Golden Regression.

No domain engine, migration, database, ledger, identity authority, authorization matrix, provider integration, or existing marketplace flow was rewritten. Node >=24 certification remains a separate Phase 16.13 gate.

Regression: **12/12 Phase 16 controls PASS; Phase 0 Golden Regression 21 PASS / 0 FAIL** under the available Node 22.16.0 environment. This is not Node >=24 certification.

Next: **Phase 16.13 — Node >=24 Certification**.

## Phase 16.13 — Node >=24 Certification

Implemented `phase0/phase16.13-node24-certification.mjs` and `phase0/PHASE16.13-NODE24-CERTIFICATION.md` as the supported-runtime certification gate. The gate preserves the root and backend `engines.node = ">=24"` requirements, runs the complete Phase 16.12 cumulative regression in the same runtime, and refuses to promote Node 22 compatibility evidence to Node >=24 certification.

Verification in the current environment: Phase 16.12 cumulative regression **PASS** under Node `v22.16.0`; Phase 16.13 is **BLOCKED BY RUNTIME** because the available runtime is below the declared Node >=24 requirement. No runtime requirement was lowered and no domain/platform authority was rewritten.

Next: **Phase 16.14 — Final Platform Snapshot** after a real Node >=24 certification run.

## Phase 16.14 — Final Platform Snapshot

Prepared `phase0/phase16.14-final-platform-snapshot.mjs` and `phase0/PHASE16.14-FINAL-PLATFORM-SNAPSHOT.md` as the final snapshot/integrity gate. The snapshot preserves the Phase 16.13 source of truth and refuses to mark the platform fully certified while Node >=24 certification remains blocked. No domain/platform authority was rewritten.

Current verification: snapshot structure and Node >=24 declarations **PASS**; Phase 16.13 certification remains **BLOCKED BY RUNTIME** under Node `v22.16.0`. Final certification is deferred until the same snapshot passes under a real Node >=24 runtime.

Next required release action: execute `npm run test:phase16.13` and then `npm run test:phase16.14` under Node >=24, regenerate the final source/hash/archive snapshot, and only then mark Phase 16.14 **FINAL CERTIFIED**.
