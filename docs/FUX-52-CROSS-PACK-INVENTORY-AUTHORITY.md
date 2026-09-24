# FUX-52 — Cross-Pack Inventory Authority Reconciliation

## Objective

Verify that inventory-affecting commerce packs converge on the same canonical physical inventory authority rather than creating parallel stock ledgers.

## Canonical authority

`inventory_movements` is the physical stock ledger.

The canonical command boundary is:

`recordCanonicalInventoryMovement() → POST /tenants/:chatId/inventory/movements → appendInventoryMovement() → inventory_movements`

Balances are projections derived from the movement ledger.

## Reconciled flows

| Flow | Inventory consequence | Authority |
|---|---|---|
| Warehouse receiving / adjustment | PURCHASE / ADJUSTMENT movement | Canonical inventory API |
| Procurement receiving | PURCHASE movement per receipt line | Canonical procurement receipt → canonical inventory movement |
| Core fulfillment terminal | SALE movement | Core fulfillment transaction |
| Marketplace checkout | SALE movement + canonical balance check | Canonical inventory ledger |
| Marketplace cancellation | RETURN movement + canonical balance projection | Canonical inventory ledger |
| Restaurant kitchen | No inventory mutation at kitchen-status transition | Order/kitchen projection only |
| Ordinary seller order sync | No independent stock ledger introduced | Canonical order authority; physical consequence remains fulfillment/inventory-bound |

## FUX-52 hardening

Marketplace previously treated `catalog_products.stock` as the stock authority while also writing `inventory_movements`. That created two competing representations.

The marketplace path now:

1. Reads the canonical balance from `inventory_movements`.
2. Rejects checkout when the canonical balance is insufficient.
3. Records the SALE through `appendInventoryMovement()` with a deterministic event ID.
4. Updates `catalog_products.stock` only as a compatibility projection.
5. Uses the same pattern for cancellation: canonical RETURN first, then projection update.

This preserves compatibility with older catalog consumers while removing the marketplace stock row as an independent authority.

## Idempotency / replay

Marketplace SALE and RETURN movements use deterministic event IDs. `appendInventoryMovement()` returns an existing movement when the event ID has already been recorded.

The existing sync event boundary also retains replay protection by `event_id`.

## Explicit non-goals

- No payment work is included.
- No second inventory ledger is introduced.
- No restaurant kitchen stock mutation is invented.
- Physical Android/offline runtime validation remains separate evidence.
