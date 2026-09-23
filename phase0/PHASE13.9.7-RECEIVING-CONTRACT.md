# Phase 13.9.7 — Receiving Contract

**Status:** Implemented
**Date:** 2026-09-07

## Scope
Formalize the existing Warehouse Receiving workflow without introducing a second receiving persistence model, inventory authority, product authority, or location registry.

## Authority
- Warehouse owns Receiving workflow semantics.
- Commerce remains Product authority.
- Core Inventory remains stock mutation and movement authority.
- Core Locations remains Organization Location authority.
- The existing legacy `warehouseLocations` representation remains a storage-bin concept and is not promoted to Core Location authority.

## Contract
`app/src/verticals/warehouse/receiving-contract.js` provides a persistence-neutral normalized Receiving contract.

The contract carries:
- receiving identity and organization scope
- Core Product identity
- Core Organization Location identity
- positive received quantity
- optional batch, expiry, storage-bin, reference, and notes metadata
- canonical `received` movement semantics
- `warehouse_receiving` reference semantics
- deterministic `event_id` idempotency identity

The contract delegates inventory mutation to the existing Phase 13.9.4 bridge and therefore to:

- `app/src/warehouse/inventory.js#applyStockChange`
- `app/src/warehouse/ledger.js#recordInventoryMovement`

## Safety rules
- Receiving must reference the supplied Core Product.
- Receiving, Product, and Organization Location must share the same organization.
- Quantity must be finite and greater than zero.
- Missing Receiving identity is rejected.
- No stock mutation occurs inside the contract module.
- No receiving table or parallel Warehouse inventory ledger is introduced.
- `event_id` remains the repeat-operation identity.

## Compatibility
No database migration was introduced.

No existing Warehouse, Inventory, Location, or Fulfillment implementation was rewritten.

The existing `saveReceiveModal()` workflow remains operational and continues to use the existing Inventory mutation path.

## Verification
Command:

```text
npm run test:phase13.9.7
```

Result:

```text
Phase 13.9.7 Warehouse Receiving Contract Regression: PASS
```

## Next step
**Phase 13.9.8 — Stock Adjustment Contract.**
