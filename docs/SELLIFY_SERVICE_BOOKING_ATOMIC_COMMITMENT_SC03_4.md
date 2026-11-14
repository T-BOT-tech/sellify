# Sellify SC-03.4 — Conflict-Safe Service Booking Resource Commitment

Status: Draft implementation specification and code work package  
Authority: Service Pack / canonical Service Booking store  
Depends on: SC-03.1 Resource Foundation, SC-03.2 Availability Declarations, SC-03.3 Declared-Window Assessment and Service Booking Authorization

## Objective

Make a Service Booking transition to `CONFIRMED` only when one active, compatible Service Resource can be committed for the booking's exact requested interval. The booking transition, resource commitment, idempotency command, and audit evidence must be persisted atomically.

## Canonical boundary

`Service Resource → Declared Availability → Feasibility Assessment → Atomic Booking Commitment`

- Service Booking remains the booking lifecycle authority.
- Service Resource owns the provider/facility/equipment identity and its declared schedule.
- Service Booking owns the commitment to a resource interval.
- Logistics Scheduling is not used as a universal appointment calendar.
- Commerce Order, Payment, Fulfillment, Inventory, and Logistics authorities are not mutated by appointment confirmation.
- Provider capacity declarations remain declarations; they are not a source of confirmed availability.

## Confirmation preconditions

A `CONFIRMED` transition requires:

1. A current, tenant-owned booking in `ACCEPTED` state and matching `expected_version`.
2. An explicit `resource_id` in the confirmation command.
3. An active Service Resource owned by the same organization and tenant.
4. If the resource is service-item-bound, its `service_item_id` must match the booking.
5. If the resource is location-bound, its location must match the canonical order location.
6. A valid persisted working-hours/exception declaration and valid IANA timezone.
7. The entire requested interval must be inside a declared working interval. `UNKNOWN`, cross-local-date, missing schedule, or outside-hours results fail closed.
8. No existing `COMMITTED` interval may overlap the requested interval for that resource.

Adjacent intervals are allowed: a commitment ending exactly when another begins is not an overlap.

## Atomic transaction

The existing `transitionServiceBooking()` command uses SQLite `BEGIN IMMEDIATE`. For confirmation it:

1. Re-reads the tenant organization and booking under the write transaction.
2. Checks idempotency replay and expected booking version.
3. Re-reads the active resource and validates service-item and order-location binding.
4. Re-reads the declared schedule and evaluates the booking's requested interval.
5. Queries active commitments using `existing.start < requested.end AND existing.end > requested.start`.
6. Updates the booking to `CONFIRMED`, records its assigned resource, and advances its version.
7. Inserts the resource commitment.
8. Inserts the idempotency command record and audit event.
9. Commits the transaction.

Any error rolls back all writes. SQLite's write transaction serializes competing confirmations, so overlapping requests cannot both pass the conflict check and commit.

## Persistence

Migration 80 adds additive booking commitment fields and `service_booking_resource_commitments`.

The commitment record stores organization/tenant, booking, resource, requested interval, state, actor, and timestamps. `COMMITTED` intervals block overlap. `RELEASED` records remain as history and no longer block future appointments.

The existing booking row exposes assigned resource, commitment state, and committed timestamp. Legacy bookings are not assigned synthetic resources or retroactively marked committed.

## Release semantics

- `COMPLETED`, `CANCELLED`, and `FAILED` release an existing commitment in the same transaction as the booking transition.
- `IN_PROGRESS` retains the commitment.
- Rejection before confirmation creates no commitment.
- A booking cannot be re-confirmed after a terminal transition under the existing lifecycle contract.

## UI

The existing Service Booking operator workspace:
- Shows an active compatible resource selector for accepted bookings.
- Filters choices by service-item binding and canonical order location.
- Disables confirmation when no eligible active resource is available.
- Displays the assigned resource after confirmation.
- Surfaces API conflicts and leaves the booking unchanged on failure.
- Keeps Provider self-service limited to assigned resource availability.
- Keeps Logistics Dispatcher/Manager outside Service Booking lifecycle operations.

The UI does not optimistically show confirmation. The server response is authoritative.

## Authorization

The existing central authorization evaluator remains authoritative:
- `service:booking:confirm` authorizes the booking lifecycle action.
- `service:service_resource:manage` is separately checked against the exact resource context.
- Resource ID, organization, and location context must match.
- Provider role has no booking lifecycle permission.
- Logistics contextual roles do not receive Service Booking permission.

## Regression requirements

- Explicit resource required.
- Inactive/foreign resource rejected.
- Service-item and location mismatch rejected.
- Missing/invalid schedule and outside-declared-hours rejected.
- Overlapping commitment rejected.
- Concurrent overlapping confirmations produce exactly one winner.
- Adjacent intervals both commit.
- Idempotent replay does not create a duplicate commitment.
- Version conflicts and tenant isolation remain enforced.
- Completion/cancellation/failure release commitments atomically.
- Booking and commitment audit evidence is durable.
- Canonical Order, Payment, Fulfillment, Inventory, and Logistics state remain unchanged.
- Operator UI exposes resource selection, disabled/empty states, conflict handling, and all 13 locale translations.

## Explicitly deferred

- Customer appointment discovery and slot browsing (SC-03.5).
- Resource re-assignment after confirmation.
- Multi-resource appointments.
- Recurring appointments and multi-day bookings.
- Provider capacity verification beyond declared schedule.
- Automatic payment capture, order state changes, fulfillment, or logistics execution.
- Any universal calendar or new reservation authority.
