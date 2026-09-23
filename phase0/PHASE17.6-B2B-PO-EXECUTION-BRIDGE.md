# Phase 17.6 — Procurement → Existing B2B Purchase Order Execution Bridge

## Purpose

Connect a **CONFIRMED Procurement Award** to the existing canonical B2B Purchase Order authority without creating a second PO system.

## Forensic finding

The existing B2B PO implementation required:

```text
Accepted B2B Quote → Purchase Order
```

and its legacy PO schema required both `customer_id` and `quote_id`. A Procurement Award instead identifies a buyer organization and supplier organization directly. Creating a fake Customer or fake accepted Quote would duplicate identity or commercial authority.

Phase 17.6 therefore extends the **existing `purchase_orders` authority** with an explicit origin:

```text
B2B_QUOTE
PROCUREMENT_AWARD
```

The legacy path remains unchanged.

## Procurement-origin PO

A procurement-origin PO contains:

- buyer `organization_id`
- `supplier_organization_id`
- `procurement_award_id`
- `source_type = PROCUREMENT_AWARD`
- no synthetic `customer_id`
- no synthetic `quote_id`
- immutable snapshot line items

## Split awards

A split award cannot become one PO containing multiple suppliers.

```text
Confirmed Award
  ├── Supplier A → PO-A
  └── Supplier B → PO-B
```

Each supplier receives one PO per confirmed award.

## Execution gates

The bridge requires:

1. Award exists in the buyer organization.
2. Award is `CONFIRMED`.
3. Award has at least one line.
4. Supplier is actually awarded.
5. One supplier is selected per PO.
6. Every awarded line has a canonical Product ID.
7. Award quantity is a positive integer because the existing PO contract requires integer quantities.
8. Award currency matches the buyer organization currency.
9. Existing B2B PO creation authorization remains required.
10. Procurement execution authorization is also required.

Specification-only procurement remains valid before this boundary, but cannot cross into the current PO contract until a canonical Product is attached.

## State flow

```text
CONFIRMED PROCUREMENT AWARD
          ↓
Procurement Execution Bridge
          ↓
Existing B2B Purchase Order
          ↓
DRAFT
          ↓
SUBMITTED
          ↓
APPROVED
          ↓
Future fulfillment / order execution
```

PO approval does not create an Order in this phase.

## Explicit non-effects

This phase does not create or mutate:

- a second PO authority
- B2B Quote
- Customer identity
- Inventory
- Payment ledger
- AR
- Invoice
- Settlement
- Commerce Order

## Migration

Migration **26** evolves the existing `purchase_orders` table while preserving all legacy rows and constraints. It adds procurement source metadata and permits the procurement-origin representation.

## API

No new PO endpoint is required. The existing endpoint remains canonical:

```text
POST /tenants/:chatId/b2b/purchase-orders
```

with:

```json
{
  "sourceType": "PROCUREMENT_AWARD",
  "procurementAwardId": "...",
  "supplierOrganizationId": "..."
}
```

## Regression

`phase0/phase17.6-procurement-po-bridge-regression.mjs` verifies:

- migration 26
- confirmed-award prerequisite
- supplier selection for split awards
- one PO per supplier
- product/quantity execution gates
- duplicate PO rejection
- procurement-origin source metadata
- legacy B2B Quote → PO compatibility
- no inventory/payment mutation
- organization isolation
