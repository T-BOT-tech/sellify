# Phase 13.11.4 — Warehouse ↔ Inventory Integration

## Status

CANONICAL EXECUTION BOUNDARY CORRECTED; full product workflow remains PARTIAL.

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

The contract is persistence-neutral and delegates execution to the existing canonical Inventory movement API.

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
11. Execution is delegated to `app/src/warehouse/ledger.js#recordCanonicalInventoryMovement`.
12. Movement persistence, authorization, idempotency and audit remain owned by the canonical Inventory backend.
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
\n## Remaining product integration\n\nThe handoff contract and both bridge modules now target the canonical Inventory movement API. The receiving/adjustment user journey is not yet proven to invoke these contracts from the persisted Warehouse UI/API workflow. Do not mark Stage 2.2 complete until that caller, pending/unknown UI state and authenticated HTTP persistence regression are covered.\n