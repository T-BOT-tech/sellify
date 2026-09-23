# Phase 12.2 — Fulfillment Compatibility Bridge

**Status:** Implemented narrowly  
**Date:** 2026-09-07  
**Scope:** Bridge existing local fulfillment fields into the Phase 12 physical-flow boundary.

## Source inspection

The supplied Phase 12.1 continuation archive was inspected before modification.

Existing authoritative fulfillment behavior is in:

- `app/src/orders/checkout.js`
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/ui.js`
- `app/src/logistics/physical-flow.js`
- `app/src/warehouse/inventory.js`

The actual checkout writes:

```text
fulfillment_type
fulfillment_status
delivery_address
pickup_location
scheduled_time
```

The existing lifecycle advances those order fields in `logistics/fulfillment.js`.

The existing stock mutation authority remains `warehouse/inventory.js` through
`applyStockChange()`, with `stock_deducted` guarding the final-state deduction.

## Canonical physical-flow projection

`toPhysicalFlow(order)` remains a pure compatibility mapper.

Canonical representation:

```text
{
  id,
  source,
  orderId,
  type,
  status,
  destination,
  scheduledAt,
  trackingReference,
  proof,
  stockDeducted,
  final
}
```

The bridge maps:

| Existing order field | Canonical field |
|---|---|
| `id` | `id` / `orderId` |
| `fulfillment_type` | `type` |
| `fulfillment_status` | `status` |
| `delivery_address` or `pickup_location` | `destination` |
| `scheduled_time` | `scheduledAt` |
| `tracking_reference` | `trackingReference` |
| `fulfillment_proof` | `proof` |
| `stock_deducted` | `stockDeducted` |
| `delivered` / `picked_up` | `final` |

Historical prefixed address/schedule aliases are read-only fallbacks.

## Authority

No new fulfillment persistence table or lifecycle engine was introduced.

```text
Existing Order
  ├── fulfillment_type
  ├── fulfillment_status
  └── stock_deducted
          ↓
   Physical Flow Projection
```

The existing order fields remain authoritative.

Inventory stock mutation remains authoritative in `applyStockChange()`.

## Migration

**None.**

This increment is a pure read/projection bridge and therefore requires no
database migration or backfill.

## Compatibility

The bridge accepts the field names actually emitted by current checkout while
also reading older prefixed aliases. It does not mutate orders.

No marketplace fulfillment table, warehouse ledger, Payment Core, checkout
flow, or existing lifecycle was replaced.

## Tests

Added:

```text
phase0/phase12.2-fulfillment-bridge-regression.mjs
```

Covers:

- delivery projection
- pickup projection
- `fulfillment_type`
- `fulfillment_status`
- `stock_deducted`
- destination/schedule mapping
- final-state projection
- historical field aliases
- no mutation of the source order
- non-physical order rejection

Run:

```bash
npm run phase12.2:fulfillment-test
```

## Deliberately not changed

- `app/src/logistics/fulfillment.js` lifecycle semantics
- `app/src/warehouse/inventory.js` stock authority
- backend marketplace fulfillment persistence
- marketplace checkout
- order schema
- printing adapters
- warehouse system
- logistics UI
- Payment Core

Reason: Phase 12.2 is the compatibility bridge only. Lifecycle hardening,
physical lifecycle tests, printing contract work beyond the existing 12.1
boundary, and warehouse hardening remain later bounded increments.

## Release boundary

This does not constitute Phase 12 completion. The next bounded increment is
**12.3 — Physical Lifecycle Tests**.

Supported release certification still requires Node >=24. Local verification in
the available environment must not be represented as Node 24 certification.
