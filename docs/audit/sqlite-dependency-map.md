# SQLite persistence dependency map — initial evidence map

**Static inventory baseline:** `main` at `07985fcc841e3f16fd5b6f4f46f1bb5101443085`  
**Audit branch:** `audit/route-auth-sqlite-continuation-20261123`  
**Source:** `backend/lib/store-sqlite.js`  
**Manual characterization baseline:** current `main` at `15737ee0c83e057113baa3881638186542ed6999`  
**Status:** static counts below remain anchored to the original baseline; 20 selected functions have been manually re-characterized against current main. SQL read/write ownership and transaction graph remain in progress.

## Verified source inventory

| Measure | Current source result |
|---|---:|
| Exported functions | 253 |
| Unique `CREATE TABLE` names | 110 |
| `CREATE TABLE` declarations | 112 |
| `CREATE INDEX` declarations | 206 |
| Distinct index names | 192 |
| Unique index declarations | 14 |
| Inline `REFERENCES` clauses | 292 |
| Distinct referenced tables | 37 |
| Explicit migration guards | 85 |
| Migration versions | 1–85, contiguous |
| `.prepare()` / `.exec()` calls | 978 / 333 |
| `.run()` / `.get()` / `.all()` calls | 349 / 482 / 165 |
| `BEGIN` / `BEGIN IMMEDIATE` tokens | 107 / 64 |
| `COMMIT` / `ROLLBACK` / `SAVEPOINT` tokens | 100 / 65 / 1 |
| Source size at static inventory baseline | 965,573 bytes |

## Findings that change the earlier inventory picture

The older inventory scanner counted tables and migration guards but did not enumerate indexes or foreign-key references. Current source inspection finds 206 index declarations and 292 inline `REFERENCES` clauses. The schema therefore has meaningful relational constraints that must be preserved during any persistence extraction.

All 85 explicit `applied.includes(N)` migration guards are present in contiguous numeric order from 1 through 85. This is a source-level sequence check, not a proof of deployed database migration state.

## What is not yet established

- Which exported functions read or write each table.
- Which functions call other exported or internal functions.
- Which `BEGIN`/commit/rollback sequences belong to which functions and whether all exits are safe.
- Which indexes and constraints are relied on by specific queries or concurrency guarantees.
- Migration dependencies and backfill/compatibility requirements.
- Canonical table ownership and cross-domain invariants.

The JSON companion lists every exported function, table, index declaration, reference clause, and migration guard. It now includes a corrected per-function lexical SQL/call scan; unverified ownership remains explicitly marked rather than inferred from names.

## Transaction caution

The lexical counts of transaction-control tokens are not a transaction graph. Do not compare aggregate `BEGIN`, `COMMIT`, and `ROLLBACK` counts as proof of balanced transactions. The next pass must locate each transaction block, its owning function, all early returns/throws, replay checks, audit/event writes, and any nested transaction helper.

## Extraction decision

**No persistence extraction is approved by this pass.** Keep the existing store as one authority until function-to-table dependencies, transaction boundaries, migration constraints, and cross-domain invariants are mapped. In particular, do not split Payment, Inventory, Orders/Fulfillment, Supplier Network, or Logistics based only on names or table prefixes.


## Characterization batch 1 — Customer and B2B Pricing persistence

**Status:** 8 exported functions and their direct/helper dependencies characterized.

| Function | Read tables | Write tables | Important boundary |
|---|---|---|---|
| `listCustomers` | `tenants`, `customers` | — | Organization-scoped list; limit 1–200 |
| `getCustomer` | `tenants`, `customers` | — | ID and organization constrained |
| `upsertCustomer` | `tenants`, `customers`, `locations` | `customers`, `audit_events` | Organization natural-key upsert; optional location scope; sparse sync semantics |
| `updateCustomer` | `tenants`, `customers`, `locations` | `customers`, `audit_events` | Read/merge/upsert; alias handling; PR #304 makes standalone customer write plus audit atomic |
| `listCustomerPricing` | `tenants`, `customer_pricing_rules` | — | Organization-scoped list; limit 1–500 |
| `getCustomerPricing` | `tenants`, `customer_pricing_rules` | — | ID and organization constrained |
| `upsertCustomerPricing` | `tenants`, `customers`, `catalog_products` | `customer_pricing_rules`, `audit_events` | Business-customer/product/currency invariants; unique organization/customer/product key |
| `updateCustomerPricing` | `tenants`, `customer_pricing_rules`, `customers`, `catalog_products` | `customer_pricing_rules`, `audit_events` | Reads existing row then delegates to validated upsert |

### Relational and authority observations

- `customers.organization_id` references `organizations.id`; `customers.default_location_id` references `locations.id`.
- `customer_pricing_rules.organization_id` references `organizations.id`; `customer_pricing_rules.customer_id` references `customers.id`.
- `customer_pricing_rules.product_id` has no declared SQL foreign key to `catalog_products`; same-tenant product ownership is enforced by `assertCatalogProductForOrganization` in the store layer.
- The pricing table has a unique constraint on `(organization_id, customer_id, product_id)`; its indexes support organization/customer/status and organization/product/status lookup.
- Customer standalone mutations and their audit events are now atomic on current main (PR #304); the Customer HTTP regression forces audit failure and verifies rollback. B2B pricing mutation and audit are also atomic after PR #305. Do not carry the original pre-fix atomicity finding forward as an open issue.

### Resolved defect carried from the route audit

RESOLVED on current main by PR #305. The store reloads the persisted row by its unique business key, audits the canonical row ID, and commits the pricing mutation plus audit append atomically.



## Preliminary function-level SQL dependency scan

A corrected lightweight lexical scan was run against each exported function body after locating the closing parameter list (important for functions with default object parameters). It detected SQL table references in **228 of 253 exported functions**, and direct calls to another exported store function in **84 functions**. This is a useful navigation index, not a complete SQL parser or call graph. Per-function findings are included in the JSON companion with the scan method attached.

### Cross-domain coupling candidates requiring manual review

The corrected scan identifies 66 functions with table references spanning more than one heuristic table-domain label. The most important examples include:

| Function | Read/write tables | Why it matters |
|---|---|---|
| `createMarketplaceOrder` | `catalog_products`, `inventory_movements`, `marketplace_* `, `tenants`, `locations` | Checkout coordinates catalog eligibility, stock reservation, marketplace order, and payment allocation/settlement records. |
| `updateMarketplaceOrderStatus` | `orders`, `catalog_products`, `inventory_movements`, `marketplace_* `, `payments`, `payment_refunds`, `tenants`, `locations` | Cancellation/transition coordinates reservation release, physical inventory restoration, payment/refund and settlement effects. |
| `createProcurementReceipt` | `procurement_receipts`, `procurement_receipt_lines`, `purchase_orders`, `purchase_order_items`, `catalog_products`, `locations` | Receiving crosses procurement records and canonical inventory movement. |
| `saveCatalog` | `catalog_products`, `inventory_movements`, `orders`, `tenants` | Catalog replacement checks order/inventory history and seeds opening balances in its transaction. |
| `assignDeliveryCourier` / `transitionDeliveryAssignment` | `delivery_assignments`, `fulfillments`, `orders`, `memberships`, `membership_roles`, `tenants` | Logistics assignment depends on canonical fulfillment/order and scoped courier identity. |
| `transitionOrderFulfillment` | `fulfillments`, `fulfillment_commands`, `delivery_assignments`, `orders`, `locations`, `tenants`, `users` | Fulfillment lifecycle is coupled to delivery-assignment invariants and tenant/location scope. |
| `transitionServiceBooking` | `service_bookings`, `service_resource_commitments`, `service_resource_availability`, `service_resources`, `orders`, `locations`, `organizations`, `tenants` | Booking lifecycle coordinates canonical order, resource capacity/commitment, and location scope. |
| `recordServiceDeliveryAssessment` | `orders`, `service_delivery_assessment_commands`, `tenants` | Service delivery assessment is an idempotent command against canonical order state. |

These are dependency candidates, not incorrect ownership findings. Read projections and transaction coordinators may legitimately cross domains. The correct extraction boundary must preserve the canonical transaction and authority.

### Immediate extraction implications

- Do not extract `updateMarketplaceOrderStatus` as a standalone marketplace module without first mapping the inventory/payment/refund consequences and transaction contract.
- Do not split `saveCatalog` away from its catalog-type immutability checks and opening-balance initialization.
- Do not move `getDeliveryAssignment` without preserving courier role, assignment ownership, and location-grant checks.
- Keep `getOrderPaymentSummary` a read projection; it must not become a second payment authority.
- The next manual pass should inspect high-fan-out transaction coordinators and their callers, not divide functions solely by table prefixes.

**Caution:** the scan's table-domain hints are intentionally heuristic. Validate each candidate against actual SQL, helper bodies, event/audit writes, and canonical domain contracts before changing code.


## Migration source-order finding

The 85 numbered guards cover versions 1–85 when sorted numerically, but **the source order in `runMigrations()` is not monotonic**. The source has 12 version drops, including 60→39, 75→67, 67→63, 63→46, 59→50, and a descending run 50→49→48→47→41→33→31.

This is not by itself proof of a broken migration: some migration blocks may be independent or may depend only on earlier base schema. However, it means the existing inventory gate's sorted-version check does not prove that a fresh database can execute migrations in a safe dependency order. `runMigrations()` executes the guards in source order, not sorted version order.

**Required follow-up:** build a migration dependency graph from each migration's DDL/DML, including referenced tables/columns/indexes and data backfills. Verify a fresh-database path and upgrade paths from supported historical versions. Do not reorder migration blocks merely to make the source look numeric; preserve deployed compatibility and explicit idempotent repair behavior.


## Characterization batch 2 — Identity and access-control persistence

Current main: `15737ee0c83e057113baa3881638186542ed6999`.

| Function | Reads | Writes | Boundary |
|---|---|---|---|
| `listUserMemberships` | memberships, tenants | — | Active memberships for authenticated user |
| `createSession` | memberships, tenants, locations, membership_roles, pack_lifecycle | devices, sessions | Requires active membership; tenant-bound session |
| `authenticateSessionToken` | sessions, devices, memberships, tenants, locations, membership_roles, pack_lifecycle | devices | Validates session/device/membership/expiry; updates last-seen |
| `createAuthChallenge` | — | auth_challenges | Hashed, expiring challenge |
| `consumeAuthChallenge` | auth_challenges | auth_challenges | Reads then marks used; no explicit transaction/conditional claim |
| `createPairingChallenge` | memberships | pairing_challenges, audit_events | Store role check; challenge and audit not explicitly atomic |
| `consumePairingChallenge` | pairing_challenges | users, memberships, membership_roles, pairing_challenges, audit_events | Explicit transaction; session issued after commit |
| `createInvite` | memberships | invites, audit_events | Store role check; invite and audit not explicitly atomic |
| `consumeInvite` | invites, memberships | memberships, membership_roles, invites, audit_events | Explicit transaction covers membership grant/upgrade, token use and audit |
| `revokeInvite` | memberships, invites | invites, audit_events | Store repeats owner/manager and tenant checks |
| `revokeDevice` | memberships, devices | devices, sessions, audit_events | Store repeats self-vs-other authorization |
| `changeMembershipRole` | memberships, membership_roles | memberships, membership_roles, audit_events | Store enforces role hierarchy, self-change and last-owner invariants |
| `assignMembershipContextualRole` | tenants, locations, service_resources, memberships, membership_roles, pack_lifecycle | membership_roles, audit_events | Store validates role scope and service-provider resource rules |
| `revokeMembershipContextualRole` | memberships, membership_roles | membership_roles, audit_events | Store enforces owner/manager and target membership scope |
| `ensureMembershipSync` | memberships | memberships, membership_roles, audit_events | Synchronous helper; callers may own transaction |
| `getTenantByApiKey` | tenants | — | Legacy migration lookup |

Tenant creation uses a separate explicit transaction for tenant bootstrap and challenge replay protection. Membership base roles and contextual roles are separate persisted representations.

### Single-use token caveat

The challenge, pairing and invite consumers read token state before the final write/transaction. There is no `await` between read and mutation, so same-process event-loop interleaving is not established. Cross-process/multi-connection single-use semantics remain conditional until the supported SQLite deployment topology is confirmed; this is not a confirmed vulnerability.


## Migration source-order characterization — current main

**Source inspected:** `backend/lib/store-sqlite.js` at `15737ee0c83e057113baa3881638186542ed6999`, `runMigrations()` lines 287–3606.

The runner creates `schema_migrations`, reads the already-applied version set, then evaluates guarded migration blocks in their literal source order. The source contains 85 migration guards, versions 1 through 85 exactly once, with no missing version numbers. It contains 12 source-order decreases:

| Previous version | Next version | Next block line | Directly observable note |
|---:|---:|---:|---|
| 60 | 39 | 2130 | Version 60 rebuilds marketplace payment allocations before version 39 creates Telegram storefront configuration |
| 75 | 67 | 2712 | Version 67 adds payment status-query claim/lease columns |
| 67 | 63 | 2745 | Version 63 adds provider-notification/authentication columns and indexes to `payment_evidence` |
| 63 | 46 | 2769 | Version 46 adds `payment_intent_id` to `payments` |
| 55 | 53 | 2869 | Version 53 creates provider capability certification persistence |
| 59 | 50 | 2947 | Version 50 creates payment settlement persistence |
| 50 | 49 | 2986 | Version 49 creates payment refund persistence |
| 49 | 48 | 3025 | Version 48 rebuilds payment and payment-ledger tables to expand lifecycle states |
| 48 | 47 | 3111 | Version 47 adds columns/indexes to payment reconciliation |
| 47 | 41 | 3134 | Version 41 creates the multi-role membership compatibility bridge |
| 41 | 33 | 3170 | Version 33 creates Supplier Network service-area persistence |
| 33 | 31 | 3202 | Version 31 creates Supplier Network capability persistence |

The source explicitly comments that payment migrations 61–63 are placed after migration 45 creates `payment_evidence`. It also explicitly keeps migration 54 independent of migration 53 so installations with 53 recorded can still apply 54 after an interrupted or older deployment. These comments are direct evidence of intentional ordering/recovery considerations. They do not explain every source-order decrease.

### Existing migration regression coverage found

| Regression | What its source actually exercises |
|---|---|
| `gap-1.18I-migration-independence-regression.mjs` | Seeds migration 53 without 54, invokes the real store migration runner, checks migration 54/index; also simulates partial migration 63 and retries through the real runner |
| `gap-1.23-migration-retry-runtime-regression.mjs` | Tests migration 63 with column-presence variants, preserved evidence, uniqueness scope and interrupted retry |
| `service-resource-migration-80-81-compatibility-regression.mjs` | Runs against a fresh temporary DB, constructs two historical v80 schema shapes, restarts the store and checks migration 81 compatibility |
| `sc-03.4-resource-commitment-migration-regression.mjs` | Runs against a fresh temporary DB and checks migration 80 schema, indexes, foreign keys and uniqueness |

All four have package scripts in current `package.json`. Their source files and script registrations were reviewed; **they were not executed in this audit session**.

### What is and is not established

- Established: 85 unique, contiguous version guards; 12 literal source-order decreases; runner evaluates blocks in source order; selected interrupted-upgrade and historical-shape regressions exist.
- Not established: a complete dependency DAG for every migration; successful execution of every supported historical upgrade path; a full fresh-install and upgrade test run in this audit session.
- No evidence supports renumbering or reordering the migrations merely to make source order monotonic. Do not reorder them.
- Next migration work should map each block's actual DDL/DML prerequisites and data transformations, then execute the existing regression scripts and add only missing representative upgrade fixtures. Treat any suspected dependency as unverified until the relevant schema state and test demonstrate it.


## Characterization batch 3 — Procurement demand persistence

Current `main` at `15737ee0c83e057113baa3881638186542ed6999`, `backend/lib/store-sqlite.js` lines 4128–4369.

| Function | Read dependencies | Write dependencies | Transaction boundary |
|---|---|---|---|
| `createProcurementDemand` | tenant/org, active membership, optional location, catalog product, existing idempotency record | `procurement_demands`, `procurement_demand_items`, `audit_events` | `BEGIN IMMEDIATE` covers header, all item inserts and audit |
| `getProcurementDemand` | `procurement_demands`, `procurement_demand_items` | — | Read-only; demand lookup constrained by organization |
| `listProcurementDemands` | `procurement_demands`, `procurement_demand_items` | — | Read-only; organization/status/requester filters and bounded limit |
| `updateProcurementDemand` | tenant/org, active membership, location, catalog product, demand and items | `procurement_demands`, `procurement_demand_items`, `audit_events` | `BEGIN IMMEDIATE` covers draft update, item replacement and audit |
| `transitionProcurementDemand` | tenant/org, active membership and current demand | `procurement_demands`, `audit_events` | `BEGIN IMMEDIATE` covers status transition and audit |

The store's `assertProcurementActor` enforces active membership in the organization; the HTTP handler separately enforces the specific procurement-demand permission. Do not treat the store membership check as a replacement for route authorization.

### Existing regression evidence reviewed

`phase0/phase17.1-procurement-demand-regression.mjs` covers creation, replay with the same idempotency key, payload mismatch, draft editing, submit/sourcing transitions, invalid transition and audit rows. `phase0/phase17.1-procurement-demand-contract-regression.mjs` checks the state-transition contract. Both are source-reviewed only; not executed in this audit session.
