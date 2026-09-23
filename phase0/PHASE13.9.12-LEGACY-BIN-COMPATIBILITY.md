# Phase 13.9.12 — Legacy Bin Compatibility

**Status:** Implemented  
**Date:** 2026-09-07

## Purpose

Preserve the existing Warehouse storage-bin representation while formalizing
its boundary against the canonical Organization Location registry.

## Existing authority retained

- `state.warehouseLocations` remains the legacy storage-bin collection.
- `STORAGE_KEYS.warehouseLocations` remains its persistence key.
- `app/src/warehouse/locations.js` remains the existing CRUD/persistence path.
- Legacy bins retain the existing `{ id, name }` shape.

## Canonical location boundary

Canonical organization locations remain owned by Core Locations and are exposed
to Warehouse through `state.organizationLocations` and `config.locationId`.
Legacy bins are not organization locations and are not promoted into that registry.

## Compatibility rules

1. Existing bin records remain readable without migration.
2. Valid legacy bins require a non-empty `id` and `name` for contract projection.
3. Bin metadata is not merged into `organizationLocations`.
4. A legacy bin cannot become canonical merely by appearing in Warehouse state.
5. No new database table, registry, or authority is introduced.
6. Existing Warehouse UI persistence remains unchanged.

## Non-goals

- No schema migration.
- No deletion or rewriting of legacy bins.
- No conversion of bin IDs into canonical location IDs.
- No duplicate location authority.

## Regression

`phase13.9.12-warehouse-legacy-bin-compatibility-regression.mjs` verifies the
existing state/storage boundaries, legacy shape compatibility, canonical
location separation, and contract metadata.
