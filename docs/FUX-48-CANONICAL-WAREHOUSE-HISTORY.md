# FUX-48 — Canonical Warehouse History Reconciliation

## Status

Implemented on main.

## Problem

Warehouse inventory balances and mutations now use the canonical inventory ledger, but the Warehouse Receiving and Transactions tabs still rendered the legacy stockTransactions projection directly.

This created an evidence/UI split:
- canonical inventory movements could be recorded and synchronized;
- Warehouse history could still present only the legacy local projection;
- a user could therefore see an operational history that was not the canonical inventory record.

## Resolution

Warehouse history now follows this authority order:
1. load canonical inventory movements from GET /tenants/:chatId/inventory/movements;
2. render canonical movements when canonical history is available;
3. use legacy stockTransactions history only when canonical history is unavailable.

The legacy history remains a compatibility fallback for older/offline installations. It is no longer preferred when canonical movement data exists.

Receiving history filters canonical PURCHASE movements.

Canonical history displays product identity, quantity, movement type, occurred-at timestamp, reference, synchronization state, and movement reason.

## Authority boundary

FUX-46 established canonical mutation authority.
FUX-47 established canonical balance projection.
FUX-48 closes the remaining Warehouse history projection gap.

The intended chain is now:
Warehouse UI mutation → canonical inventory movement → canonical balance → canonical history UI

Legacy stockTransactions remains compatibility-only and is not treated as server confirmation.

## Offline behavior

If the canonical movement endpoint cannot be reached, the ledger module retains local canonical movement data and the existing legacy history remains available as fallback.

No legacy history entry is promoted to a confirmed server result.

## Regression

phase0/fux-48-canonical-warehouse-history-regression.mjs

The regression verifies canonical movement state is consumed by Warehouse UI, canonical history loading and rendering are wired, synchronization state is visible, legacy history remains explicitly fallback-compatible, and canonical movement API loading remains connected.

CI script: npm run test:fux-48

## Remaining evidence gap

This is source-level reconciliation only. Physical Android/offline/reconnect runtime validation remains deferred.