# Phase 13.8.2 — Restaurant Tables Integration

## Objective
Bridge the existing Restaurant Tables implementation to the canonical Organization → Location registry without replacing table storage or creating a RestaurantLocation authority.

## Source inspection
Inspected `app/src/restaurant/tables.js`, `app/src/warehouse/locations.js`, `app/src/state.js`, and the existing Phase 13.8.1 Restaurant boundary.

## Current source of truth
- Table behavior/storage: `app/src/restaurant/tables.js`
- Organization locations: `app/src/warehouse/locations.js` / `state.organizationLocations`
- Current tenant/location context: `config.chatId` / `config.locationId`

## Change
Added `app/src/verticals/restaurant/table-integration.js`. It resolves an active Core location for a table context, validates organization scope, and returns a read-only integration projection. Existing table CRUD/status/transfer behavior remains owned by `tables.js`.

## Migration
None. This increment is a compatibility bridge; no database schema or existing authority is replaced.

## Tests
- `npm run phase13.8.2:restaurant-tables-test`
- `npm run phase13.8.1:restaurant-boundary-test`
- Phase 12.8 regression gate

## Deliberately not changed
No table-storage rewrite, no RestaurantLocation entity, no order/inventory/payment rewrite, no UI rewrite, and no new event system.
