# GAP-2 — Logistics Authorization Foundation

Status: **FOUNDATION + CANONICAL DELIVERY ASSIGNMENT LIFECYCLE + ROLE-AWARE WORKLOAD PROJECTION IMPLEMENTED / ADVANCED DISPATCH UI DEFERRED**

## Why this gap exists

Sellify already has a canonical Core Fulfillment authority and a Logistics Pack, but the
Logistics role family was previously only product-model metadata. The security boundary
must distinguish logistics coordination from generic fulfillment mutation.

## Implemented

Canonical policy roles:

- `logistics_manager`
- `logistics_dispatcher`
- `logistics_courier`
- `logistics_viewer`

The roles are registered in the existing central authorization policy. They do not create
a second permission evaluator or persistence authority.

The Logistics Pack is now required before contextual logistics roles can be assigned, and
inactive-pack contextual roles are excluded from authenticated session role resolution.

### Capability boundary

| Role | Current foundation |
|---|---|
| Logistics Manager | fulfillment view/update; delivery view/assign/reassign; assigned-delivery capability; location/audit visibility |
| Dispatcher/Coordinator | fulfillment view/update; delivery view/assign/reassign; location visibility |
| Courier | delivery view + `update_assigned`; **no generic `fulfillment:update`** |
| Viewer | delivery/fulfillment read-only |

## Delivery assignment authority implemented

A canonical `delivery_assignments` table now owns the delivery-to-courier relationship. Assignment is organization-scoped, location-scoped when the courier role is location-scoped, idempotent by assignment key, and protected against assigning the same delivery to a different courier.

The fulfillment command endpoint now distinguishes Courier actors from generic fulfillment operators. A Courier must hold the logistics courier capability **and** have an active assignment for the target delivery. Generic `fulfillment:update` remains denied to Courier.

## Implemented lifecycle boundary

The assignment authority now supports a canonical lifecycle:

`ASSIGNED -> ACCEPTED -> OUT_FOR_DELIVERY -> DELIVERED`

with controlled terminal exception paths for `CANCELLED`, `FAILED`, and `REASSIGNED`.
Historical assignments are retained, while a partial unique index permits only one active assignment per fulfillment. Lifecycle commands require an idempotency key and are audited. Courier completion requires delivery proof and atomically applies the existing terminal fulfillment inventory consequence.

Courier actions are server-enforced against the active assignment; dispatcher/manager reassignment and exception actions use the logistics reassignment capability.

### Current frontend boundary

The Logistics frontend now consumes the canonical active-assignment workload endpoint and renders the assigned courier/status projection plus a workload summary grouped by lifecycle status and courier. Assignment lifecycle commands are exposed through the canonical PATCH contract with idempotency keys. Courier-facing lifecycle controls are present for accept/start/complete-with-proof, while advanced dispatch filtering/balancing and realistic tenant certification remain deferred.

### Still deferred

1. richer workload/dispatch controls such as explicit status/location/courier filters and workload balancing;
2. full Delivery Staff UI for assign/reassign/accept/start/complete/proof actions;
3. end-to-end assignment integration certification against realistic tenant fixtures.

Frontend visibility alone must never authorize courier actions.

## Validation

`npm run test:gap-2-logistics-authz`

The regression verifies role separation, organization isolation, active Logistics Pack
gating, and the Courier rule that generic fulfillment mutation remains denied.
