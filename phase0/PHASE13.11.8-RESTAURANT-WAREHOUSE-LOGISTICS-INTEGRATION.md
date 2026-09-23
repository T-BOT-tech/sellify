# Phase 13.11.8 — Restaurant ↔ Warehouse / Logistics Integration

## Purpose

Formalize the existing Restaurant → Warehouse / Logistics boundary without
creating a second Order, Inventory, Fulfillment, Warehouse, or Logistics
authority.

## Authority model

```text
Restaurant
  ├── Table
  ├── KitchenTicket
  ├── Recipe
  └── Preparation
          │
          ▼
   Core Commerce Order/Product
          │
          ├──────────────► Warehouse pack
          │                 (consume/integrate)
          │
          └──────────────► Logistics pack
                            (coordinate/project)

Core Inventory ── sole stock mutation / movement authority
Core Fulfillment ─ sole physical lifecycle authority
Locations ─────── canonical organization/location authority
```

## Implemented contract

`app/src/verticals/restaurant/warehouse-logistics-contract.js`

The contract is persistence-neutral and composes the existing:

- Restaurant Order compatibility bridge
- Restaurant Kitchen integration bridge
- Warehouse Fulfillment boundary
- Logistics Fulfillment boundary

It exposes one normalized physical-commerce context containing:

- `order_id`
- `organization_id`
- `location_id`
- KitchenTicket identity/status/readiness
- Warehouse fulfillment projection
- Logistics fulfillment projection
- canonical authority declarations
- existing idempotency/stock-deduction boundary

## Scope controls

- Restaurant remains semantic owner of kitchen/table/recipe/preparation concepts.
- Commerce remains Order/Product authority.
- Warehouse does not receive a WarehouseFulfillment authority.
- Logistics does not receive a LogisticsFulfillment authority.
- Inventory remains the sole stock mutation/ledger authority.
- Fulfillment remains the physical lifecycle authority.
- Locations remain canonical.
- Organization and location continuity is explicitly checked.
- Restaurant kitchen readiness is represented as a projection gate (`ready` / `served`), not a new fulfillment state machine.
- No direct `product.stock` mutation is introduced.
- No new persistence model is introduced.
- No route engine/provider is implemented.
- No cross-pack god-service/orchestrator is introduced.

## Important non-implementation boundary

Current source does not provide a distinct Warehouse Picking/Packing/Dispatch
persistence authority. Therefore this phase does **not** invent one. The
contract only formalizes the existing physical fulfillment projection and the
existing Warehouse/Logistics boundaries.

## Regression coverage

`phase0/phase13.11.8-restaurant-warehouse-logistics-regression.mjs`

Verifies:

1. Restaurant kitchen → physical fulfillment continuity.
2. Commerce Order/Product authority preservation.
3. Warehouse/Inventory authority preservation.
4. Logistics/Fulfillment authority preservation.
5. Organization isolation.
6. Location continuity.
7. Invalid physical fulfillment rejection.
8. Invalid fulfillment status rejection.
9. Duplicate Restaurant Order/Inventory/Fulfillment authorities blocked.
10. Direct Restaurant stock mutation blocked.
11. Route implementation remains blocked.
12. Persistence remains absent from the cross-pack contract.

## Result

```text
Phase 13.11.8 Restaurant ↔ Warehouse / Logistics Integration Regression: PASS
Restaurant kitchen → physical fulfillment continuity: PASS
Commerce Order / Product authority preserved: PASS
Warehouse / Inventory authority preserved: PASS
Logistics / Fulfillment authority preserved: PASS
Organization / location continuity: PASS
Direct Restaurant stock mutation: BLOCKED
Duplicate Restaurant Fulfillment / Inventory / Order authority: BLOCKED
Route implementation: BLOCKED
```

## Runtime note

The repository continues to require Node `>=24`. This environment is running
Node `v22.16.0`, so Node 24 release certification is not claimed here.
