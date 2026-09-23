# Phase 13.11.4 — Warehouse ↔ Inventory Integration

## Status

IMPLEMENTED / REGRESSION VERIFIED under the current runtime.

Node >=24 remains a separate release-certification requirement because the current execution environment is Node 22.

## Objective

Formalize the Warehouse ↔ Core Inventory handoff without creating another inventory authority.

## Canonical ownership

```text
Warehouse
  owns receiving / stock-adjustment workflow semantics
          |
          v
Warehouse Inventory Handoff Contract
          |
          +----> Core Commerce Product authority
          |
          +----> Core Locations authority
          |
          v
Core Inventory
  applyStockChange
          |
          v
Core Inventory Ledger
  recordInventoryMovement
```

## Implemented contract

`app/src/verticals/warehouse/inventory-contract.js`

It supports the two currently formalized Warehouse stock operations:

- `receive`
- `adjust`

The contract is persistence-neutral and delegates execution to the existing Inventory mutation authority.

## Invariants

1. Warehouse does not own Product.
2. Warehouse does not own Inventory.
3. Warehouse does not own the Inventory Ledger.
4. Warehouse cannot directly mutate `product.stock` through the integration contract.
5. Every handoff is organization-scoped.
6. Product and Location references must belong to the Warehouse operation's organization.
7. Operation identity becomes the canonical reference ID.
8. `event_id` is preserved for deterministic replay/idempotency handoff.
9. Receiving maps to `received` / `warehouse_receiving`.
10. Adjustment maps to `adjusted` / `warehouse_stock_adjustment`.
11. Execution is delegated to `app/src/warehouse/inventory.js#applyStockChange`.
12. Movement recording remains delegated to `app/src/warehouse/ledger.js#recordInventoryMovement`.
13. No second persistence store is introduced.

## Explicit non-goals

This phase does not implement:

- a new inventory engine
- a Warehouse ledger
- a warehouse stock database
- picking/packing/dispatch state machines
- reservation authority
- cross-pack event orchestration
- synchronization redesign

Those concerns remain in their existing authorities or later approved phases.

## Regression

Run:

```bash
npm run test:phase13.11.4
```

Expected result:

```text
Phase 13.11.4 Warehouse ↔ Inventory Integration Regression: PASS
```
