# Phase 13.10.13 — Routes Scope Decision Record

**Status:** COMPLETE — 2026-09-08  
**Decision type:** Control/documentation-only; explicit non-build

## Objective

Record the approved scope for the Logistics `Route` concept without introducing
route persistence, a routing engine, optimization behavior, external maps/carrier
APIs, or a second logistics authority.

## Actual source inspected

Before this decision record, the current Phase 13.10.12 source was inspected,
including:

- `app/src/verticals/logistics/pack.js`
- `app/src/verticals/logistics/authority-map.js`
- `app/src/verticals/logistics/courier-assignment-contract.js`
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/physical-flow.js`
- `app/src/storage/migration.js`
- `app/src/constants.js`
- Phase 13.10.12 Logistics regression source

The inspected source confirms:

- `Route` is a recognized Logistics domain entity and `logistics-routes` is a
  declared Logistics capability.
- `authority-map.js` assigns Route semantics to `logistics-pack`.
- `pack.js` currently declares `routes: []`; there is no route implementation
  module or route persistence model.
- The migration mechanism remains the existing generic storage migration and
  contains no Route-specific migration.
- No Route-specific storage key was found in the inspected `STORAGE_KEYS`
  declaration.
- Existing fulfillment remains authoritative at
  `app/src/logistics/fulfillment.js`.

## Decision

### Route is a recognized Logistics concept, but Route execution is deferred.

Phase 13.10.13 does **not** build a Route implementation.

The following remain intentionally unimplemented:

- Route persistence/table/collection
- Route CRUD API
- route planning engine
- route optimization
- stop sequencing engine
- distance/time calculation service
- geospatial/map provider integration
- carrier route API integration
- route webhook ingestion
- route synchronization/reconciliation
- route-specific event stream
- route-specific ledger
- route-specific authorization surface

The existing Logistics boundary may continue to name Route as a domain concept,
but that declaration is not permission to create a second operational system.

## Authority decision

| Concern | Authority / decision |
|---|---|
| Route semantics | Logistics Pack, contract-level only |
| Order | Commerce / existing Core Order |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` |
| Inventory / stock mutation | Inventory Core |
| Customer | Customers Core |
| Location | Locations Core |
| External maps/routing provider | External provider, only through an approved adapter |
| Route persistence | None introduced by this phase |
| Route optimization | Deferred |

Route therefore has **semantic ownership without implementation ownership** in
this increment.

## Adapter boundary lock

If a future route integration consumes an external routing or maps provider, the
required shape remains:

```text
Canonical Route Contract → Adapter → Provider
```

Provider-specific behavior must not be copied into the Logistics Pack as a
second provider system. External routing, optimization, map data, carrier
execution, webhooks, and provider synchronization remain external until a
separately approved adapter contract exists.

## Persistence / migration decision

**Persistence:** none.  
**Migration:** none.

This phase intentionally preserves the persistence-neutral Logistics baseline.
No Route table, collection, local registry, route ledger, or storage key is
introduced.

## Event decision

No Route-specific event is introduced. If a future implementation requires
Route events, it must use the established event boundary:

```text
Transaction → Outbox → Versioned Event → Consumer
```

and must first identify the canonical source-of-truth state, ownership,
conflict policy, reconciliation policy, and idempotency behavior.

## Why non-build is the safe decision

The current source provides no canonical Route state to persist and no existing
route execution authority to extend. Building a route engine now would therefore
invent new operational authority rather than extend an existing source of truth.
That would violate the Phase 13.10 persistence-neutral baseline and could turn
external routing behavior into a parallel internal system.

The safe next boundary is therefore to preserve Route as a declared Logistics
concept while deferring implementation until an approved increment supplies a
canonical contract and persistence/adapter decision.

## Regression / control expectations

The Phase 13.10.13 regression must prove:

- Route remains declared by the Logistics Pack;
- Route remains mapped to `logistics-pack` semantics;
- no Route implementation module is introduced;
- no Route-specific storage key or migration is introduced;
- no route engine/optimization/provider implementation is introduced;
- the adapter boundary remains `Canonical Contract → Adapter → Provider`;
- no existing Core authority is replaced.

## Runtime

Observed implementation environment: Node `v22.16.0`.

The project release requirement remains Node `>=24` because the project uses
`node:sqlite`. Node 22 execution is regression evidence only and is not Node
>=24 release certification.

## Exit

**PHASE 13.10.13 — ROUTES SCOPE DECISION COMPLETE**

No production Route implementation was added by this increment.
