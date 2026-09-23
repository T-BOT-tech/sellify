# Phase 13.11.9 — Unified Fulfillment Contract

## Objective

Formalize one canonical, persistence-neutral fulfillment context across the existing Commerce, Fulfillment, Warehouse, Logistics, Agriculture, and Restaurant boundaries without introducing another fulfillment authority.

## Canonical authority

- Commerce owns the canonical Order and Product identity.
- `app/src/logistics/fulfillment.js` owns fulfillment lifecycle mutation.
- Inventory owns stock mutation and movement ledger.
- Warehouse consumes and integrates the fulfillment projection.
- Logistics coordinates and projects shipment/delivery/proof/courier state.
- Agriculture contributes agricultural semantics only.
- Restaurant contributes kitchen/table/recipe/preparation semantics only.

## Implementation

Added `app/src/logistics/unified-fulfillment-contract.js`.

The contract composes existing read/projection boundaries:

- `app/src/logistics/physical-flow.js`
- `app/src/verticals/warehouse/fulfillment-boundary.js`
- `app/src/verticals/logistics/fulfillment-boundary.js`
- `app/src/verticals/agriculture/warehouse-logistics-contract.js`
- `app/src/verticals/restaurant/warehouse-logistics-contract.js`

The unified context is identified as `unified-fulfillment:<core-order-id>` and preserves organization/location scope, order identity, fulfillment type/status, warehouse stock state, logistics shipment/tracking/proof state, and optional vertical projections.

## Explicit non-goals

- No `UnifiedFulfillment` table/entity.
- No duplicate `*Fulfillment` authority.
- No direct stock mutation.
- No new order/product/inventory authority.
- No event publisher or event bus introduced.
- No dispatch engine.
- No route engine/provider implementation.
- No new persistence.

## Execution boundary

This increment is projection-only. Existing lifecycle and stock mutation capabilities remain responsible for mutations. The contract does not call or replace them.

## Regression

`phase0/phase13.11.9-unified-fulfillment-regression.mjs`

The regression verifies:

1. canonical Order → Core Fulfillment continuity;
2. Warehouse/Inventory authority preservation;
3. Logistics coordination preservation;
4. Restaurant vertical projection continuity;
5. organization/location isolation;
6. duplicate fulfillment/order/inventory authority is blocked;
7. direct stock mutation and persistence are blocked;
8. dispatch and route implementation remain blocked.

## Runtime note

Node runtime remains `v22.16.0` in the current environment. The repository requirement remains Node `>=24`; this phase does not lower or alter that requirement.
