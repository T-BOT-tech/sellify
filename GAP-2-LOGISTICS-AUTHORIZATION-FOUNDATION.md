# GAP-2 — Logistics Authorization Foundation

Status: **FOUNDATION IMPLEMENTED / DELIVERY ASSIGNMENT ENFORCEMENT DEFERRED**

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

## Important deferred boundary

`logistics:deliveries:update_assigned` is a policy capability, not yet a complete
server-side assignment authorization implementation.

Before Courier can mutate delivery state, Sellify still needs the canonical relationship:

`delivery -> assignment -> membership/user`

and server-side enforcement that the actor is assigned to that delivery within the
organization/location scope.

Required follow-up:

1. canonical delivery assignment persistence/authority;
2. assign/reassign lifecycle and concurrency semantics;
3. Courier own-assignment server enforcement;
4. proof/status mutation authorization;
5. audit events and idempotency/replay behavior;
6. Delivery Staff UI consuming those canonical contracts.

Frontend visibility alone must never authorize courier actions.

## Validation

`npm run test:gap-2-logistics-authz`

The regression verifies role separation, organization isolation, active Logistics Pack
gating, and the Courier rule that generic fulfillment mutation remains denied.
