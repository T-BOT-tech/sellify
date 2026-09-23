# Phase 13.9.2 — Warehouse Authority Map

## Status
COMPLETE

## Scope
This step formalizes the authority map for the Warehouse Pack boundary established in Phase 13.9.1. It records, for each Warehouse integration concept, the authoritative owner, direction of interaction, conflict policy, and reconciliation policy.

## Authority rules
- Commerce owns product identity/master data and orders.
- Inventory owns stock and inventory movements.
- Locations owns canonical organization locations.
- Warehouse owns storage-bin concepts only; bins remain distinct from organization locations.
- Customers owns customer identity.
- Fulfillment owns fulfillment lifecycle.
- Audit remains a Core authority.
- Warehouse does not create a parallel order, product, inventory, payment, customer, location, fulfillment, or ledger authority.

## Existing implementation alignment
The map is declarative and does not move or rewrite existing Warehouse modules. Stock mutation remains in `app/src/warehouse/inventory.js`; inventory movement recording remains in `app/src/warehouse/ledger.js`; organization-location integration remains in `app/src/warehouse/locations.js`; fulfillment integration remains in `app/src/logistics/fulfillment.js`.

## Conflict and reconciliation policy
Every mapped concept explicitly identifies who wins conflicts and how the existing state/event paths are reconciled. In particular, inventory reconciliation follows the existing movement stream rather than introducing a second Warehouse ledger, and organization locations remain distinct from Warehouse storage bins.

## Migration
None.

## Verification
`node phase0/phase13.9.2-warehouse-authority-map-regression.mjs` passes.

## Deferred
Phase 13.9.3 Existing Module Boundary Tests is the next step. No receiving, stock-adjustment, configuration, adversarial, legacy-bin, cumulative-gate, Node >=24, hash, or source-snapshot work is included in this step.
