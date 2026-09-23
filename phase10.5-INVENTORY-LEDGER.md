# Phase 10.5 — Inventory Ledger

Status: implemented additively.

## Objective

Introduce a canonical, append-only inventory movement stream without replacing
Sellify's existing `product.stock` projection, warehouse UI, or local
`stockTransactions` history.

Target relationship:

```text
Product
  ↓
InventoryMovement*
  ↓
Location
```

The current stock field remains the compatibility projection until the ledger
has been validated in real operation.

## Backend migration

Migration 9 adds `inventory_movements` with:

- `id`
- `event_id` (unique/idempotency key)
- `organization_id`
- `location_id`
- `product_id`
- `quantity`
- `movement_type`
- `reference_type`
- `reference_id`
- `actor_id`
- `device_id`
- `occurred_at`
- `reason`
- `metadata_json`
- `created_at`

Existing tracked catalog stock is projected into one `OPENING_BALANCE` movement
per organization/product/default location. The projection is only created when
no ledger movement exists for that product, so later catalog saves do not
create duplicate openings.

## Canonical movement types

```text
PURCHASE
SALE
RETURN
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
DAMAGE
LOSS
RESERVATION
RELEASE
OPENING_BALANCE
```

## Backend API

```text
GET  /tenants/:chatId/inventory/movements
GET  /tenants/:chatId/inventory/balances
POST /tenants/:chatId/inventory/movements
```

All routes are authenticated and use Phase 10.3 central authorization.

Permissions:

- owner: full access
- manager: inventory view/edit
- cashier: inventory view only
- staff: inventory view only
- buyer/viewer: no seller inventory access

## Idempotency

`event_id` is unique. Replaying the same movement returns the existing
movement rather than creating another row.

This is deliberately in place before making the ledger authoritative, because
offline devices can retry writes after reconnecting.

## Marketplace integration

Marketplace checkout now records a `SALE` movement in the same SQLite
transaction that decrements server-side catalog stock and creates the seller
sub-order.

Therefore a marketplace stock decrement cannot commit without its corresponding
inventory movement.

## Local compatibility layer

Added:

```text
app/src/warehouse/ledger.js
```

The existing `applyStockChange()` path still updates `product.stock` and the
legacy `stockTransactions` array. It additionally appends the equivalent
canonical movement and attempts best-effort server synchronization.

This preserves offline behavior and avoids a second stock mutation path.

## Location model

Movements default to the Phase 10.2 canonical default location. A future
multi-location phase can supply an explicit `locationId` without changing the
movement contract.

## Explicit non-goals

Not yet implemented:

- replacing `product.stock` with ledger-derived stock
- automatic transfer workflows
- reservations as an enforced stock hold
- lot/serial inventory
- weighted-average/FIFO costing
- purchasing/procurement
- stocktaking workflow
- negative-stock policy changes

Those should be introduced only after the movement stream is proven.

## Validation

- JavaScript syntax checks: PASS
- Phase 10.3 authorization regression: PASS
- Phase 10.5 backend ledger regression: PASS
- Phase 0 golden regression: **19 PASS / 0 FAIL**
- migration 9 creation and idempotency: covered by the golden regression

## Next phase

**Phase 10.6 — Multi-Location Inventory**

The next step should use the existing Organization → Location foundation and
move stock operations toward explicit locations while preserving the current
single-location compatibility behavior.
