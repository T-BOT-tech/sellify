# Phase 13.11.5 — Restaurant ↔ Commerce / Inventory Integration

**Status:** COMPLETE

## Objective
Formalize the Restaurant boundary into the existing Core Commerce and Core Inventory authorities without creating `RestaurantOrder`, `RestaurantInventory`, or `RestaurantPayment`.

## Actual source inspected
- `app/src/verticals/restaurant/pack.js`
- `app/src/verticals/restaurant/order-payment-compatibility.js`
- `app/src/verticals/restaurant/inventory-consumption.js`
- `app/src/verticals/restaurant/kitchen-integration.js`
- `app/src/verticals/restaurant/recipe-ingredient-bridge.js`
- Phase 13.8.7 Restaurant regression gate
- Phase 13.11.2 cross-pack contract boundaries

## Implementation
Added `app/src/verticals/restaurant/commerce-inventory-contract.js` as a persistence-neutral composition contract over the existing Restaurant bridges.

It formalizes:

```text
Restaurant semantics
  ├─ Table
  ├─ KitchenTicket
  ├─ Recipe
  └─ Preparation
       │
       ├──→ Core Commerce Order / Product
       ├──→ Core Payments
       └──→ Core Inventory stock / movement ledger
```

The contract provides:
- `buildRestaurantCommerceHandoff()`
- `buildRestaurantInventoryHandoff()`
- `buildRestaurantCommerceInventoryContext()`
- `executeRestaurantInventoryHandoff()`
- `restaurantCommerceInventoryContract()`

Inventory execution continues to delegate to the existing `consumeThroughCoreInventory()` and therefore to the existing `applyStockChange` authority.

## Persistence / migration
None. No schema, table, collection, storage key, or second ledger was added.

## API changes
No HTTP routes or public API endpoints were added.

## Authority locks
- Order → Commerce
- Product → Commerce
- Payment → Payments
- Stock mutation → Inventory
- Movement ledger → Inventory
- Restaurant → Table/KitchenTicket/Recipe/Preparation semantics
- Organization and location context must remain aligned
- Inventory replay identity remains `event_id`

## Regression coverage
Added `phase0/phase13.11.5-restaurant-commerce-inventory-regression.mjs` covering:
- canonical Commerce order handoff
- canonical Inventory consumption handoff
- payment context authority
- organization/location isolation
- product organization validation
- event identity propagation
- delegated stock mutation
- duplicate authority prohibition
- direct stock mutation prohibition

## Compatibility
Existing Phase 13.8 Restaurant bridges remain unchanged. This phase composes them rather than replacing them.

## Known release gate
The project still declares Node `>=24`. The current inspection runtime is Node 22.16.0, so this phase does not claim Node 24 production certification.
