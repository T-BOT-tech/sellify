# Phase 13.11.3 — Physical Commerce Spine

Status: COMPLETE — 2026-09-08

## Purpose

Formalize the cross-pack physical-commerce relationship without creating a
new orchestrator or duplicate domain authority.

```text
Core Commerce Order
        ↓
Existing Fulfillment lifecycle
        ↓
Warehouse integration / stock mutation
        ↓
Logistics coordination / shipment / proof
```

The projection is implemented by:

`app/src/verticals/physical-commerce/spine-contract.js`

## Current implementation truth

The contract composes the existing:

- `app/src/logistics/physical-flow.js`
- `app/src/logistics/fulfillment.js`
- `app/src/verticals/warehouse/fulfillment-boundary.js`
- `app/src/verticals/logistics/fulfillment-boundary.js`

No existing lifecycle source was rewritten.

## Authority rules

| Capability | Authority | Cross-pack role |
|---|---|---|
| Order | Commerce | canonical source |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` | canonical mutation authority |
| Stock mutation | `app/src/warehouse/inventory.js#applyStockChange` | existing inventory authority |
| Warehouse fulfillment integration | Warehouse pack | consume/integrate |
| Shipment/tracking/logistics coordination | Logistics pack | coordinate/project |
| Proof | Logistics pack over existing fulfillment fields | projection/contract |

## Dispatch boundary

The roadmap's physical sequence includes Warehouse → Dispatch, but the current
source does not contain a Warehouse Dispatch authority. Phase 13.11.3 therefore
locks dispatch as **semantic-only / not implemented** rather than inventing a
new `WarehouseDispatch` entity, lifecycle, persistence model, or route engine.

This distinction is intentional: roadmap targets are not implementation proof.

## Contract metadata

The spine declares:

- stable spine identifier
- organization scope
- source and ownership
- direction
- existing lifecycle authority
- permission boundary
- deterministic idempotency key
- conflict policy
- event behavior
- audit behavior
- reconciliation behavior
- duplicate-authority prohibitions

Persistence remains `none`; this is a read-only integration projection.

## Regression coverage

`phase0/phase13.11.3-physical-commerce-spine-regression.mjs` verifies:

1. delivery order projection
2. pickup order projection
3. canonical authority references
4. warehouse stock mutation authority
5. logistics coordination authority
6. final/non-final lifecycle interpretation
7. organization isolation
8. cross-context status consistency
9. deterministic idempotency identity
10. dispatch remains explicitly unimplemented
11. no duplicate order/fulfillment/inventory/logistics authority
12. no cross-pack orchestrator/god service

## Non-goals

This increment does not add:

- WarehouseDispatch
- a new Fulfillment entity
- a second Inventory engine
- a second Shipment store
- a route engine
- an event bus
- asynchronous synchronization
- a new persistence layer
- provider integrations
