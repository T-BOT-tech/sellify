# Phase 13.8.5 — Restaurant Inventory Consumption

## Purpose
Bridge completed Restaurant Preparation/Recipe consumption into the existing Core Inventory authority without creating `RestaurantInventory`.

## Authority boundary
- Restaurant: Recipe and Preparation semantics.
- Commerce: ingredient/product identity.
- Inventory: stock mutation and canonical movement ledger.
- Existing mutation authority: `app/src/warehouse/inventory.js` → `applyStockChange()`.
- Existing ledger: `app/src/warehouse/ledger.js` → `recordInventoryMovement()`.

## Flow
`Restaurant Preparation → validated consumption plan → Core applyStockChange(product, negative quantity, sold) → canonical inventory movement ledger`

## Idempotency
Each preparation ingredient receives:
`restaurant:preparation:<preparationId>:ingredient:<productId>`

Existing movement event IDs are skipped before mutation.

## Safety
The bridge validates the complete plan and preflights all required stock before invoking any mutation. Cross-organization products, missing products, invalid quantities, duplicate ingredients, and insufficient stock are rejected.

## Explicit non-goals
- No RestaurantInventory authority.
- No replacement of `applyStockChange()`.
- No replacement of `recordInventoryMovement()`.
- No new inventory database or migration.
- No payment/order rewrite.
