# GAP-2 — Delivery Exception Resolution

## Status

**Implemented — canonical backend exception-resolution foundation.**

The delivery assignment lifecycle now distinguishes normal courier progression from explicit exception recovery.

## Canonical behavior

Normal lifecycle:

`ASSIGNED → ACCEPTED → OUT_FOR_DELIVERY → DELIVERED`

Exception states:

- `CANCELLED`
- `FAILED`

Exception commands now require a human-readable reason.

## Exception resolution

A dispatcher/logistics manager can issue:

`REASSIGN_EXCEPTION`

against the latest cancelled/failed assignment and provide a different courier.

The server:

1. verifies tenant/organization scope;
2. requires the logistics reassign permission at the route boundary;
3. requires the target user to have an active `logistics_courier` role;
4. enforces location scope for location-scoped couriers;
5. preserves the failed/cancelled assignment as history;
6. marks that historical assignment `REASSIGNED`;
7. creates a fresh canonical `ASSIGNED` assignment;
8. records an audit event `delivery.assignment.exception_resolved`;
9. uses the supplied idempotency key so replay does not create another assignment.

## Why this matters

The previous lifecycle could record an exception but left no explicit canonical command for recovering from a terminal assignment exception. That created a dead-end in the assignment state machine.

This slice closes that authority gap without inventing a second delivery system or changing the core fulfillment inventory consequence.

## Frontend scope

Advanced exception-resolution UI remains deferred. The canonical backend command is intentionally established first so any future UI can be built against a stable contract.

## Validation

The GAP-2 lifecycle regression now checks:

- exception reason requirement;
- `REASSIGN_EXCEPTION` command;
- missing-exception rejection;
- explicit exception-resolution audit event;
- existing lifecycle/idempotency/proof constraints.

