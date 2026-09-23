# Phase 13.9.5 — Location Bridge Contract

**Status:** Implemented
**Date:** 2026-09-07
**Scope:** Formalize the Warehouse-to-Core Organization Location bridge while preserving legacy Warehouse storage bins.

## Source inspection

Inspected the actual supplied Phase 13.9.4 source for:

- `app/src/warehouse/locations.js`
- `app/src/warehouse/inventory.js`
- `app/src/warehouse/ledger.js`
- `app/src/state.js`
- `app/src/verticals/warehouse/pack.js`
- `app/src/verticals/warehouse/authority-map.js`
- existing Phase 13.9.3 and 13.9.4 regressions

The existing implementation already separates:

- `state.organizationLocations` — canonical Organization → Location registry;
- `state.warehouseLocations` — legacy Warehouse storage-bin representation.

## Contract

Added `app/src/verticals/warehouse/location-bridge.js` as a persistence-neutral compatibility bridge.

The bridge:

- resolves an explicitly selected active Core Organization Location;
- validates organization scope before exposing Warehouse location context;
- returns a read-only context containing the canonical location id, code, name, type, and active status;
- exposes a batch resolver for multiple canonical location ids;
- provides declarative authority/compatibility metadata;
- never creates, updates, deletes, or persists locations.

## Source-of-truth rules

- Organization Location identity and lifecycle remain Core Locations-owned.
- Warehouse consumes canonical Organization Locations; it does not own `WarehouseLocation`.
- `config.locationId` remains the selected location context.
- `config.organizationId` is the bridge's organization scope when supplied by the caller.
- `state.organizationLocations` remains the cached canonical registry.
- `state.warehouseLocations` remains legacy storage-bin UI state and is not merged into canonical locations.
- An inactive, missing, or cross-organization location is rejected rather than silently substituted.

## Compatibility

No database migration was introduced.

No existing Warehouse, Inventory, Location, Fulfillment, or UI implementation was rewritten.

No new location persistence or Warehouse location authority was introduced.

## Verification

Command:

```text
npm run test:phase13.9.5
```

Targeted regression covers:

- canonical active-location resolution;
- organization isolation;
- inactive/missing location rejection;
- batch context resolution;
- bridge authority declarations;
- storage-bin separation;
- read-only context shape.

Node >=24 remains the declared project runtime. This targeted step is not the Phase 13.9.14 Node >=24 release verification.

## Deliberately not changed

- `app/src/warehouse/locations.js` — remains the existing integration/legacy-bin module.
- `app/src/warehouse/inventory.js` — remains the stock mutation authority.
- `app/src/warehouse/ledger.js` — remains the movement-ledger authority.
- `backend/lib/store-sqlite.js` — no schema change is required for this compatibility bridge.
- `app/src/warehouse/ui.js` — no UI rewrite is required.
- `app/src/logistics/fulfillment.js` — fulfillment ownership is unchanged.

## Next step

**Phase 13.9.6 — Fulfillment Boundary Contract**
