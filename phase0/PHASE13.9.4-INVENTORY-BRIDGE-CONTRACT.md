# Phase 13.9.4 — Inventory Bridge Contract

**Status:** Implemented
**Date:** 2026-09-07
**Scope:** Formalize the Warehouse-to-Core Inventory bridge for existing receiving and stock-adjustment workflows.

## Contract

Warehouse owns the receiving and stock-adjustment workflow semantics. Core Inventory remains the sole stock mutation and movement authority.

The bridge exposes two persistence-neutral operations:

- `buildWarehouseReceivingBridge()` → existing Core Product + Organization Location → `received` movement
- `buildWarehouseStockAdjustmentBridge()` → existing Core Product + Organization Location → `adjusted` movement

Execution is delegated to the existing:

- `app/src/warehouse/inventory.js#applyStockChange`
- `app/src/warehouse/ledger.js#recordInventoryMovement`

The bridge never writes `product.stock`, `stockTransactions`, or inventory movements itself.

## Source-of-truth rules

- Product identity remains Commerce-owned.
- Stock remains Inventory-owned.
- Organization location remains Locations-owned.
- Warehouse receiving/adjustment references are organization-scoped.
- Receiving uses a positive quantity.
- Stock adjustment accepts a finite non-zero delta, including negative correction values.
- `event_id` is the repeat-operation identity carried into the existing Inventory mutation path.
- No Warehouse inventory ledger or Warehouse product authority is introduced.

## Compatibility

No database migration was introduced.

No existing Warehouse or Inventory implementation was rewritten.

No new persistence authority was introduced.

## Verification

Command:

```text
npm run test:phase13.9.4
```

Result:

```text
Phase 13.9.4 Warehouse Inventory Bridge Regression: PASS
```

The regression covers receiving, adjustment, organization isolation, product identity, quantity validation, delegation to `applyStockChange`, and bridge authority declarations.

The project still declares Node >=24. This step is not the Node >=24 release verification scheduled for Phase 13.9.14.

## Next step

**Phase 13.9.5 — Location Bridge Contract**
