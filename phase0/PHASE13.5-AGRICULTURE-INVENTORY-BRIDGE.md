# Phase 13.5 — Agriculture Inventory Bridge

Status: implemented additively.

## Boundary

```text
Agriculture Harvest
      ↓
Collection Center → canonical Location
      ↓
existing Inventory.applyStockChange()
      ↓
existing canonical inventory movement ledger
```

Agriculture does not create `AgricultureInventory`.

## Rules

- Existing Product remains the stock-bearing Core product.
- Existing `applyStockChange()` remains the stock mutation authority.
- Existing inventory movement ledger remains the canonical movement stream.
- Collection Center bridges to an existing Core Location.
- Harvest receipt uses `referenceType=agriculture_harvest`.
- Harvest receipt uses a deterministic event ID: `agriculture:harvest:<harvestId>:received`.
- Replayed harvest receipts are detected before stock mutation and do not apply a second stock change.
- Organization mismatches are rejected.
- Warehouse/Inventory must be enabled for an actual receipt.
- The persistence-neutral contract is isolated from browser/runtime imports so it can be regression-tested independently.

## Deferred

No Agriculture inventory table, separate stock ledger, inventory UI, commodity sale, buyer order, payment or fulfillment flow is introduced in this phase.
