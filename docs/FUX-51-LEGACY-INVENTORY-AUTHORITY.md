# FUX-51 — Legacy Inventory Authority Boundary

## Objective

Close the remaining legacy inventory compatibility boundary so old local stock mutation code cannot silently become an operational authority again.

## Result

The active Warehouse UI already uses the canonical inventory movement API. FUX-51 adds a hard guard to the retained `applyStockChange()` compatibility function:

- authenticated/current installations cannot execute the legacy local stock mutation;
- products already represented in canonical inventory cannot use the legacy mutation;
- callers receive an explicit `LEGACY_INVENTORY_MUTATION_DISABLED` error directing migration to the canonical movement API;
- legacy history/state remains readable as a compatibility projection where needed;
- the legacy `recordInventoryMovement()` helper is not a second ledger: it emits the same canonical `inventory.movement.record` event used by synchronization.

## Authority rule

`Warehouse intent → recordCanonicalInventoryMovement() → canonical inventory API / durable outbox → inventory_movements`

Legacy `product.stock` and `stockTransactions` may remain for backward-compatible installs/history display, but they cannot be used as the authoritative mutation path on connected/current installations.

## Certification boundary

This source regression does not prove every historical install or physical Android device. Runtime/device migration remains separate evidence.
