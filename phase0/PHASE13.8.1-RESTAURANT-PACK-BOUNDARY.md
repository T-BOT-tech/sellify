# SELLIFY PHASE 13.8.1 — RESTAURANT PACK BOUNDARY

## Status

VERIFIED — 2026-09-07

## Purpose

Formalize the existing Restaurant implementation as a Phase 13 vertical pack boundary without rewriting or replacing the existing Restaurant modules.

## Existing implementation retained

- `app/src/restaurant/tables.js`
- `app/src/restaurant/kitchen.js`

These remain the implementation owners for current Tables and Kitchen behavior.

## Restaurant-owned concepts

- Table
- KitchenTicket
- Recipe
- Preparation

`KitchenTicket` is a boundary concept over the existing order/kitchen-status representation; this phase does not create a second ticket store.

## Core bridges

| Restaurant concern | Authority |
|---|---|
| Order | Core Commerce / Orders |
| Menu product | Core Commerce / Products |
| Modifier definition | Core Commerce / Products |
| Ingredient stock | Core Inventory |
| Customer | Core Customers |
| Restaurant location | Core Locations |
| Fulfillment | Core Fulfillment |
| Payment | Payment Core |
| Audit | Core Audit |

## Explicit non-goals

This phase does not create:

- RestaurantOrder
- RestaurantInventory
- RestaurantPayment
- RestaurantCustomer
- RestaurantLocation
- RestaurantFulfillment

It also does not move, rewrite, or replace `tables.js` or `kitchen.js`.

## Permissions

Existing fine-grained permissions remain authoritative:

- `tables:manage`
- `tables:status`
- `kitchen:manage`

## UI

The existing `tables` and `kitchen` entry points remain in place. No dynamic route loader or plugin marketplace is introduced.

## Verification

`phase0/phase13.8.1-restaurant-pack-boundary-regression.mjs` verifies:

- pack manifest identity and capabilities
- required Core dependencies
- existing Restaurant module presence
- existing table and kitchen exports
- permission boundary
- Core bridge mapping
- absence of parallel authorities

The Phase 12.8 regression gate was also rerun and passed, including the Phase 0 Golden Regression (21 PASS / 0 FAIL).

Verification runtime: Node v22.16.0.
Supported release runtime remains Node >=24.
