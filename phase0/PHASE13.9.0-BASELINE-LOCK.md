# Sellify Phase 13.9.0 — Warehouse Pack Baseline Lock

## Status

LOCKED — 2026-09-07

## Source of truth

Phase 13.9.0 starts directly from the supplied Phase 13.8.7 Restaurant
Regression Gate verified source archive:

`SELLIFY_PHASE13_8_7_RESTAURANT_REGRESSION_GATE_VERIFIED_2026-09-07.zip`

Archive SHA-256 is recorded in `PHASE13.9.0-BASELINE-SOURCE-HASHES.sha256`.

The archive was extracted and the actual production source was inspected before
any Phase 13.9 implementation work. No Phase 13.9 production code is included
in this baseline lock.

## Baseline verification

The authoritative Phase 13.8.7 Restaurant Regression Gate was executed from the
supplied source archive before the Warehouse Pack work began.

Result:

**PASS**

Coverage included:

- Phase 13.8.1 Restaurant Pack Boundary
- Phase 13.8.2 Restaurant Tables Integration
- Phase 13.8.3 Restaurant Kitchen Integration
- Phase 13.8.4 Restaurant Recipe / Ingredient Bridge
- Phase 13.8.5 Restaurant Inventory Consumption
- Phase 13.8.6 Restaurant Order / Payment Compatibility
- Phase 12.8 Physical Commerce Regression Gate
- Phase 0 Golden Regression — 21 PASS / 0 FAIL

Observed verification runtime: Node `v22.16.0`.

The project release/runtime declaration remains Node `>=24`. The observed Node
22 execution is recorded for transparency and does not constitute Node >=24
release certification.

## Locked package identity

- Project package: `sellify`
- Version: `0.2.0`
- Node engine: `>=24`
- Module type: `module`

## Locked existing Warehouse implementation

The following existing modules are the starting point for Phase 13.9 and must
not be rewritten merely to create the Pack boundary:

- `app/src/warehouse/inventory.js`
- `app/src/warehouse/ledger.js`
- `app/src/warehouse/locations.js`
- `app/src/warehouse/ui.js`
- `app/src/logistics/fulfillment.js`

Their baseline hashes are recorded in
`PHASE13.9.0-BASELINE-SOURCE-HASHES.sha256`.

## Locked authorities

Phase 13.9 must preserve the authorities already established by the baseline:

- Core Commerce / Products and Orders
- Core Inventory stock mutation and canonical movement ledger
- Core Customers / identity
- Core Locations
- Core Fulfillment
- Core Audit
- Existing Warehouse operational implementation
- Existing Logistics implementation

## Non-rewrite rule

Phase 13.9 must not:

- replace Core Inventory;
- create a second inventory ledger;
- create a second location registry;
- create a Warehouse Order authority;
- create a Warehouse Payment authority;
- create a Warehouse Customer authority;
- create a Warehouse Fulfillment authority;
- rewrite existing Warehouse operational modules;
- rewrite existing Fulfillment implementation;
- introduce a dynamic plugin marketplace;
- add a database migration unless later inspection proves an existing migration
  is strictly required.

## Location compatibility lock

The baseline contains two distinct location concepts which must remain distinct:

- `state.organizationLocations` — canonical organization/location registry.
- `state.warehouseLocations` — legacy Warehouse storage-bin representation.

Phase 13.9 must not merge these registries or introduce a new
`WarehouseLocation` authority.

## Inventory authority lock

The baseline Warehouse stock path uses Core Inventory authority. The canonical
mutation and movement-ledger functions are:

- `applyStockChange()`
- `recordInventoryMovement()`

Phase 13.9 may formalize the Warehouse boundary around these functions but may
not replace them with a parallel Warehouse stock writer or ledger.

## Permission lock

The existing `inventory:edit` permission remains authoritative for Warehouse
stock mutation. Phase 13.9 does not begin with a replacement Warehouse-specific
stock-edit permission.

## Migration lock

The supplied baseline contains no `backend/migrations` directory. Phase 13.9.0
therefore records **no migration change** as part of the baseline.

## Baseline source hashes

See:

`phase0/PHASE13.9.0-BASELINE-SOURCE-HASHES.sha256`

These hashes are the comparison point for the subsequent Phase 13.9 steps.

## Exit condition

Phase 13.9.0 is complete when:

1. the supplied Phase 13.8.7 source archive has passed its authoritative gate;
2. the actual Warehouse / Inventory / Location / Fulfillment source has been
   inspected;
3. the baseline source hashes have been recorded;
4. the Node >=24 declaration has been confirmed;
5. the non-rewrite and authority locks above are frozen.

**Phase 13.9.0 — BASELINE LOCKED.**

Next approved step: **Phase 13.9.1 — Warehouse Pack Boundary**.
