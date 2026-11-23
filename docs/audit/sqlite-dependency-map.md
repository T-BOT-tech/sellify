# SQLite persistence dependency map — initial evidence map

**Baseline:** `main` at `07985fcc841e3f16fd5b6f4f46f1bb5101443085`  
**Audit branch:** `audit/route-sqlite-characterization-20261123`  
**Source:** `backend/lib/store-sqlite.js`  
**Status:** static schema/function inventory complete; SQL read/write ownership and transaction graph remain in progress.

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
| Source size | 965,573 bytes |

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
| `updateCustomer` | `tenants`, `customers`, `locations` | `customers`, `audit_events` | Read/merge/upsert; alias handling; no explicit transaction wrapper |
| `listCustomerPricing` | `tenants`, `customer_pricing_rules` | — | Organization-scoped list; limit 1–500 |
| `getCustomerPricing` | `tenants`, `customer_pricing_rules` | — | ID and organization constrained |
| `upsertCustomerPricing` | `tenants`, `customers`, `catalog_products` | `customer_pricing_rules`, `audit_events` | Business-customer/product/currency invariants; unique organization/customer/product key |
| `updateCustomerPricing` | `tenants`, `customer_pricing_rules`, `customers`, `catalog_products` | `customer_pricing_rules`, `audit_events` | Reads existing row then delegates to validated upsert |

### Relational and authority observations

- `customers.organization_id` references `organizations.id`; `customers.default_location_id` references `locations.id`.
- `customer_pricing_rules.organization_id` references `organizations.id`; `customer_pricing_rules.customer_id` references `customers.id`.
- `customer_pricing_rules.product_id` has no declared SQL foreign key to `catalog_products`; same-tenant product ownership is enforced by `assertCatalogProductForOrganization` in the store layer.
- The pricing table has a unique constraint on `(organization_id, customer_id, product_id)`; its indexes support organization/customer/status and organization/product/status lookup.
- Customer and pricing writes append audit events after the primary mutation; the inspected functions do not wrap both writes in an explicit transaction. Atomicity/failure behavior should be tested before extraction or persistence splitting.

### Confirmed defect candidate carried from the route audit

The repeated B2B Pricing POST can update an existing unique-key row but return `null` because the store fetches by a newly generated ID after SQLite retained the original row ID on conflict. This affects the current UI path, which sends no ID. Existing tests do not exercise repeated saves. Track as a focused regression/fix item; no production code changed here.



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
