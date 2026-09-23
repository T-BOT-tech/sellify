# Phase 13.8.3 — Restaurant Kitchen Integration

## Purpose

Integrate the existing Restaurant Kitchen implementation with the Core Commerce order authority without rewriting `app/src/restaurant/kitchen.js` or creating a parallel Restaurant order system.

## Authority model

- Restaurant kitchen operations: `app/src/restaurant/kitchen.js`
- Core orders: Commerce
- Payments: Payments Core
- Inventory: Inventory Core
- Customers: Customers Core
- Locations: Locations Core
- Fulfillment: Fulfillment Core

## Bridge

`app/src/verticals/restaurant/kitchen-integration.js` creates a persistence-neutral `KitchenTicket` view from an existing Core Order. The deterministic ticket identity is `kitchen:<order_id>`.

The bridge carries organization and location scope, table context, order items, kitchen status, priority, course, and timing metadata. It does not persist a second order or payment record.

## Existing behavior preserved

`app/src/restaurant/kitchen.js` remains the operational authority for rendering, status transitions, priority changes, served/undo behavior, and timers. `app/src/orders/checkout.js` remains responsible for creating the Core Order and attaching restaurant kitchen context.

## Forbidden changes

- No `RestaurantOrder`
- No `RestaurantPayment`
- No `RestaurantInventory`
- No second kitchen persistence store
- No rewrite of the existing kitchen module

## Regression

Run:

`npm run phase13.8.3:restaurant-kitchen-test`

Then run the complete `phase13.8.2` and `phase12.8` regression gates before packaging.
