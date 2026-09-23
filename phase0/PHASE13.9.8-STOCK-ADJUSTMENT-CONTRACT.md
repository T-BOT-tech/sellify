# Phase 13.9.8 — Stock Adjustment Contract

**Status:** Implemented  
**Date:** 2026-09-07  
**Scope:** Formalize the existing Warehouse stock-adjustment workflow while preserving Core Inventory authority.

## Contract

Warehouse owns the stock-adjustment workflow semantics. Core Inventory remains the sole stock mutation and movement authority.

The contract exposes:

- `buildWarehouseStockAdjustmentContract()` → existing Core Product + Organization Location → validated `adjusted` movement description
- `isWarehouseStockAdjustmentContract()` → structural contract guard
- `warehouseStockAdjustmentContract()` → authority and compatibility metadata

The contract delegates execution to the existing:

- `app/src/warehouse/inventory.js#applyStockChange`
- `app/src/warehouse/ledger.js#recordInventoryMovement`

It never mutates `product.stock`, writes `stockTransactions`, or appends an inventory movement itself.

## Source-of-truth rules

- Product identity remains Commerce-owned.
- Stock mutation and inventory movements remain Inventory-owned.
- Organization Location remains Locations-owned.
- Warehouse owns the adjustment workflow semantics and adjustment identity.
- Adjustment delta must be finite and non-zero; negative correction values remain supported.
- `reorder_point` is optional non-negative inventory metadata and is not a new Warehouse authority.
- `event_id` remains the repeat-operation identity carried by the Inventory bridge.
- `reference_type` remains `warehouse_stock_adjustment`.

## Compatibility

No database migration was introduced.

No existing Warehouse, Inventory, Product, or Location implementation was rewritten.

No Warehouse inventory ledger or parallel stock authority was introduced.

The existing UI behavior remains unchanged, including its use of the selected canonical Organization Location and the existing `applyStockChange()` path.

## Verification

Command:

```text
npm run test:phase13.9.8
```

The regression validates:

- valid positive and negative adjustments
- organization isolation
- Product identity
- Location requirement
- non-zero finite delta validation
- optional reorder-point and notes metadata
- `event_id` identity
- Core Inventory authority declarations
- absence of duplicate adjustment/inventory authority

The project still declares Node >=24. This step is not the Node >=24 release verification scheduled for Phase 13.9.14.

## Next step

**Phase 13.9.9 — Configuration**
