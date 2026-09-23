# Phase 10.6 — Multi-Location Inventory

Status: implemented additively.

## Objective

Use the existing canonical `Organization → Location` foundation for inventory
operations while preserving the legacy single-location stock projection and
legacy warehouse bin list.

## Implemented

- Canonical business locations are loaded from `GET /tenants/:chatId/locations`.
- The authenticated session's `locationId` is used as the active inventory scope.
- Warehouse inventory displays ledger-derived balance for the selected canonical location when available.
- Receiving and stock-adjustment operations attach `locationId` to the canonical inventory movement.
- Legacy `warehouseLocations` remain storage-bin labels and are no longer treated as business locations.
- Cached organization locations and ledger balances are persisted offline.
- Switching the active business location refreshes location-scoped balances without rewriting the product model.
- Existing `product.stock` and `stockTransactions` remain compatibility projections.

## Compatibility

The ledger contract remains unchanged:

```text
InventoryMovement(product, location, quantity, type, reference, actor, timestamp)
```

Existing single-location installs continue using their canonical default `STORE`
location. Existing warehouse bin names remain available for batch/bin metadata.

## Important boundary

This phase does **not** make `product.stock` location-aware or make the ledger the
sole stock authority. A future authoritative-inventory phase must first prove
that all stock-changing paths are ledger-backed and reconciled.

Transfers are still represented by the existing `TRANSFER_OUT` / `TRANSFER_IN`
movement types but are not yet an enforced two-sided workflow.

## Validation

- JavaScript syntax checks: PASS
- Phase 10.3 authorization regression: PASS
- Phase 10.5 inventory ledger regression: PASS
- Phase 10.6 multi-location regression: PASS
- Phase 0 golden regression: PASS

## Next phase

**Phase 10.7 — Outbox / Event Sync**

The next phase should make offline inventory/order/customer writes durable through
a canonical outbox and idempotent server event processing, without replacing the
existing sync paths in one rewrite.
