# GAP-2 — Logistics Authorization Foundation

Status: **FOUNDATION + CANONICAL DELIVERY ASSIGNMENT IMPLEMENTED / COURIER LIFECYCLE UI DEFERRED**

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

## Important deferred boundary

`logistics:deliveries:update_assigned` is a policy capability, not yet a complete
server-side assignment authorization implementation.

Before Courier can mutate delivery state, Sellify still needs the canonical relationship:

`delivery -> assignment -> membership/user`

and server-side enforcement that the actor is assigned to that delivery within the
organization/location scope.

Required follow-up:

1. full assign/reassign lifecycle and reassignment semantics;
2. Courier accept/start/complete lifecycle states and proof authorization;
3. richer workload/dispatch queries and location-scope resolution;
4. Delivery Staff UI consuming these canonical contracts;
5. end-to-end assignment integration certification against realistic tenant fixtures.

Frontend visibility alone must never authorize courier actions.

## Validation

`npm run test:gap-2-logistics-authz`

The regression verifies role separation, organization isolation, active Logistics Pack
gating, and the Courier rule that generic fulfillment mutation remains denied.
