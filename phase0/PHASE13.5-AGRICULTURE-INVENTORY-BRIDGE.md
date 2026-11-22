# Phase 13.5 — Agriculture Inventory Bridge

Status: canonical mutation boundary corrected; product UI/API integration remains partial.

## Boundary

```text
Agriculture Harvest
      ↓
Collection Center → canonical Location
      ↓
existing canonical Inventory movement API
      ↓
existing canonical inventory movement ledger
```

Agriculture does not create `AgricultureInventory`.

## Rules

- Existing Product remains the stock-bearing Core product.
- Existing `recordCanonicalInventoryMovement()` remains the stock mutation authority.
- Existing inventory movement ledger remains the canonical movement stream.
- Collection Center bridges to an existing Core Location.
- Harvest receipt uses `referenceType=agriculture_harvest` and the canonical Inventory movement endpoint.
- Harvest receipt uses a deterministic event ID: `agriculture:harvest:<harvestId>:received`.
- Confirmed replay is verified against the exact movement identity and intent; pending/unknown outcomes are retried through the same canonical event identity.
- Organization mismatches are rejected.
- Warehouse/Inventory must be enabled for an actual receipt.
- The persistence-neutral contract is isolated from browser/runtime imports so it can be regression-tested independently.

## Deferred

No Agriculture inventory table, separate stock ledger, inventory UI, commodity sale, buyer order, payment or fulfillment flow is introduced in this phase.
