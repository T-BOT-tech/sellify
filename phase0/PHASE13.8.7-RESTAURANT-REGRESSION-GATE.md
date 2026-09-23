# Phase 13.8.7 — Restaurant Pack Regression Gate

## Objective

Provide the final regression gate for the Restaurant Pack integration sequence 13.8.1–13.8.6 before Phase 13.9 Warehouse Pack Formalization.

## Gate Coverage

The gate verifies:

- Restaurant Pack boundary
- Tables integration
- Kitchen integration
- Recipe / ingredient bridge
- Inventory consumption
- Order / payment compatibility
- Existing Phase 12.8 Physical Commerce Regression Gate
- Required Restaurant source modules remain present
- Production runtime declaration remains Node >=24
- No forbidden parallel Restaurant authorities are introduced

## Authority Invariants

- Core Commerce owns the canonical Order.
- Core Payment owns the canonical Payment.
- Core Inventory owns stock mutation and the canonical movement ledger.
- Core Customer owns customer identity.
- Core Location owns organization locations.
- Restaurant owns Table, KitchenTicket, Recipe, and Preparation semantics.
- Existing `app/src/restaurant/tables.js` and `app/src/restaurant/kitchen.js` remain authoritative for their existing operational behavior.

## Forbidden Parallel Authorities

The gate rejects these tokens in the Restaurant production bridge sources:

- RestaurantOrder
- RestaurantInventory
- RestaurantPayment
- RestaurantCustomer
- RestaurantLocation
- RestaurantFulfillment

## Result

A PASS requires every Restaurant sub-gate and the existing Phase 12.8 gate to pass. This phase adds no database migration and no new runtime authority.
