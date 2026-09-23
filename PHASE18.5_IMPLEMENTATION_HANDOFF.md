# Phase 18.5 — Supplier Network Capacity & Availability Implementation Handoff

Status: IMPLEMENTED / REGRESSION PASS
Baseline: Phase 18.4 Supplier Network Service Areas
Migration: 34

## Authority
- Supplier Network owns declared capacity and availability signals.
- Organization remains canonical supplier identity.
- Product Core remains authoritative for products.
- Supplier Network capability remains authoritative for capability references.
- Observed capacity/performance is explicitly deferred to Phase 18.8.
- No Procurement, Product, Inventory, Payment, Settlement, or Marketplace authority is created.

## Model
`Supplier -> Capacity Signal -> Product OR Supplier Capability`

Capacity is explicitly `DECLARED` in Phase 18.5. A declaration is not an observed performance fact.

## Lifecycle
`ACTIVE <-> INACTIVE`

## Availability
`AVAILABLE | LIMITED | UNAVAILABLE | ON_REQUEST`

## API
- GET/POST `/tenants/:chatId/supplier-network/capacities`
- GET/PATCH `/tenants/:chatId/supplier-network/capacities/:id`
- POST `/tenants/:chatId/supplier-network/capacities/:id/activate`
- POST `/tenants/:chatId/supplier-network/capacities/:id/deactivate`

## Regression
- Phase 18.1: PASS
- Phase 18.2: PASS
- Phase 18.3: PASS
- Phase 18.4: PASS
- Phase 18.5: PASS
- Phase 16.12: PASS
- Phase 0 Golden: 21 PASS / 0 FAIL
- Runtime: Node v22.16.0
- Node >=24 certification remains deferred to Phase 16.13.

## Next
Phase 18.6 — Supplier Commercial Terms.
