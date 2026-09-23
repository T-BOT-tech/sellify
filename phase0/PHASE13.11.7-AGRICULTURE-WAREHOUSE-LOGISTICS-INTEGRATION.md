# Phase 13.11.7 — Agriculture ↔ Warehouse / Logistics Integration

## Status

COMPLETE — narrow contract integration only.

## Purpose

Connect the existing Agriculture physical/commercial boundaries to the existing
Warehouse and Logistics boundaries without creating a cross-pack orchestrator,
second inventory authority, second fulfillment authority, or route engine.

## Existing authorities preserved

| Capability | Authority |
|---|---|
| Agriculture vocabulary | Agriculture pack |
| Product | Core Commerce |
| Order | Core Commerce |
| Stock mutation | `app/src/warehouse/inventory.js#applyStockChange` |
| Inventory movement ledger | `app/src/warehouse/ledger.js#recordInventoryMovement` |
| Organization / Location | Core Locations |
| Warehouse receiving semantics | Warehouse pack |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` |
| Logistics coordination | Logistics pack |
| Routes | Semantic/non-build only |

## Implemented contract

Production source:

`app/src/verticals/agriculture/warehouse-logistics-contract.js`

Exports:

- `buildAgricultureWarehouseReceivingHandoff`
- `buildAgricultureLogisticsFulfillmentHandoff`
- `buildAgricultureWarehouseLogisticsContext`
- `executeAgricultureWarehouseReceivingHandoff`
- `executeAgricultureLogisticsFulfillmentHandoff`
- `isAgricultureWarehouseReceivingHandoff`
- `isAgricultureLogisticsFulfillmentHandoff`
- `AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT`

### Physical receiving path

```text
Agriculture Harvest
       ↓
existing Collection Center → Core Location identity
       ↓
Agriculture Inventory bridge
       ↓
existing Warehouse Receiving contract
       ↓
Core Inventory mutation / ledger
```

The contract checks organization, product, location and event identity continuity.
It does not create Warehouse Receiving persistence and does not mutate
`product.stock` directly.

### Commercial delivery path

```text
Agriculture Offer / Buyer Demand
       ↓
existing Core Commerce Order handoff
       ↓
existing Core Order
       ↓
existing Fulfillment lifecycle
       ↓
Logistics fulfillment projection
       ↓
Shipment / Delivery / Proof / Courier coordination
```

Logistics consumes the canonical Order/Fulfillment projection. It does not create
`AgricultureOrder`, `LogisticsOrder`, or `LogisticsFulfillment` authorities.

### Route boundary

Routes remain semantic-only in this phase. No route engine, provider integration,
or route persistence was introduced.

## Idempotency / replay

Agriculture harvest inventory identity remains the existing `event_id` boundary.
The Warehouse Receiving contract retains its own existing event identity. This
phase composes those contracts and does not introduce a third idempotency store.

## Failure / isolation rules

The regression covers:

- organization mismatch rejection
- product identity mismatch rejection
- fulfillment status validation
- organization continuity across Warehouse and Logistics contexts
- Core Product continuity
- Core Order/Fulfillment authority continuity
- event identity preservation
- direct Agriculture stock mutation prohibition
- duplicate Inventory/Order/Fulfillment authority prohibition
- route implementation prohibition

## Regression

Command:

```text
npm run test:phase13.11.7
```

Result: PASS.

## Cumulative verification

The phase also requires the immediately preceding cross-pack and physical gates
to remain green:

- Phase 13.11.6 — Agriculture ↔ Commerce / Inventory
- Phase 13.11.5 — Restaurant ↔ Commerce / Inventory
- Phase 13.11.4 — Warehouse ↔ Inventory
- Phase 13.11.3 — Physical Commerce Spine
- Phase 13.9.13 — Warehouse cumulative gate
- Phase 13.10.15 — Logistics cumulative gate

## Runtime note

The project still declares Node `>=24`. The current execution environment is
Node `v22.16.0`, so this phase is source/regression verified but is **not** a
Node >=24 release certification.
