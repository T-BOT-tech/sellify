# Phase 13.9.6 — Fulfillment Boundary Contract

## Status
IMPLEMENTED

## Date
2026-09-07

## Scope
Formalize the Warehouse Pack boundary with the existing Core Fulfillment authority without rewriting the fulfillment lifecycle.

## Authority
- `app/src/logistics/fulfillment.js` remains the fulfillment lifecycle authority.
- Commerce remains the order authority.
- `app/src/warehouse/inventory.js#applyStockChange` remains the stock mutation authority.
- Warehouse consumes fulfillment state; it does not create `WarehouseFulfillment` or a second fulfillment state machine.

## Contract
`app/src/verticals/warehouse/fulfillment-boundary.js` provides a persistence-neutral, read-only fulfillment projection for Warehouse integration.

The projection preserves the existing order fields:
- `id`
- `fulfillment_type`
- `fulfillment_status`
- `delivery_address` / `pickup_location`
- `scheduled_time`
- `tracking_reference`
- `fulfillment_proof`
- `stock_deducted`

Supported physical fulfillment types are `pickup` and `delivery`. Final states remain `picked_up` and `delivered`.

## Stock interaction
Warehouse does not mutate fulfillment state. Existing `advanceFulfillmentOrder()` owns lifecycle transitions. When a transition reaches a final state, the existing fulfillment module may call the canonical inventory mutation path, guarded by `stock_deducted` and the existing permission/preflight rules.

The bridge does not perform stock mutation and does not persist data.

## Safety rules
- Missing orders are rejected.
- Unsupported fulfillment types/statuses are rejected.
- Fulfillment lifecycle mutation remains outside the Warehouse Pack.
- `stock_deducted` remains the existing double-deduction guard.
- No parallel Warehouse fulfillment entity, table, or ledger is introduced.

## Migration
None.

## Verification
`npm run test:phase13.9.6` passes.

## Next step
**Phase 13.9.7 — Receiving Contract.**
