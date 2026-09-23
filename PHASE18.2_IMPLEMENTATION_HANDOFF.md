# PHASE 18.2 — SUPPLIER NETWORK CAPABILITY IMPLEMENTATION HANDOFF

## Status
IMPLEMENTED — CUMULATIVE REGRESSION PASS

## Baseline
Phase 18.1 Supplier Network Profile snapshot.

## Authority
`organization_id` remains the canonical supplier identity. Supplier capabilities are owned by the `supplier_network` authority and require active procurement supplier participation.

## Persistence
Migration 31 adds `supplier_network_capabilities`:
- `organization_id` canonical identity reference
- normalized machine-readable `code`
- human-readable `name`
- `category`
- `description`
- structured `metadata_json`
- visibility
- source (`DECLARED` / `VERIFIED`)
- status (`ACTIVE` / `INACTIVE`)
- actor/timestamps/version
- unique organization + capability code

## Lifecycle
`ACTIVE ↔ INACTIVE`

## Verification Boundary
Suppliers may declare capabilities, but Phase 18.2 does not allow a supplier to self-mark a capability as `VERIFIED`. Verification authority is reserved for Phase 18.7.

## API
- GET `/tenants/:chatId/supplier-network/capabilities`
- POST `/tenants/:chatId/supplier-network/capabilities`
- GET `/tenants/:chatId/supplier-network/capabilities/:id`
- PATCH `/tenants/:chatId/supplier-network/capabilities/:id`
- POST `/tenants/:chatId/supplier-network/capabilities/:id/activate`
- POST `/tenants/:chatId/supplier-network/capabilities/:id/deactivate`

## Capability Contract
`supplier-network.capability`

## Permissions
- supplier-network:capability:view
- supplier-network:capability:manage
- supplier-network:capability:activate
- supplier-network:capability:deactivate

## Boundary Guarantees
Phase 18.2 does not create or mutate:
- Product authority
- Procurement RFQs/responses/awards
- Purchase Orders
- Inventory
- Payments/Settlement
- Marketplace seller identity

## Regression
- Phase 18.1 regression: PASS
- Phase 18.2 regression: PASS
- Phase 16.12 cumulative platform regression: PASS after Golden migration expectation update
- Phase 17.10 cumulative gate: expected to remain green; Node >=24 certification remains separately deferred while test runtime is Node 22.16.0

## Next
Phase 18.3 — Supplier Catalog.
