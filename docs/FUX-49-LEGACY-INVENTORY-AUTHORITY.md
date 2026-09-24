# FUX-49 — Legacy Inventory Authority Boundary

## Status

Implemented on main.

## Finding

The Warehouse UI no longer calls the legacy local inventory mutation function. Canonical inventory movement recording is the active Warehouse mutation path.

Legacy compatibility remains in place because older installations may still contain product.stock and stockTransactions data.

## Authority rule

Active Warehouse mutations must use recordCanonicalInventoryMovement().

Legacy applyStockChange() and recordInventoryMovement() are retained only for compatibility with older code/data paths and must not be introduced as new operational UI authority.

Canonical inventory movements are synchronized through the tenant inventory movement endpoint and canonical balances are used for current stock projection when available.

## Regression

phase0/fux-49-legacy-inventory-authority-regression.mjs verifies:
- Warehouse UI does not call applyStockChange().
- Warehouse UI does not call recordInventoryMovement().
- Warehouse UI does not directly mutate stockTransactions.
- canonical inventory mutation and synchronization remain wired.
- legacy compatibility state remains explicit.

CI script: npm run test:fux-49

## Remaining evidence gap

This is source-level certification. Physical Android runtime and offline/reconnect validation remain deferred.