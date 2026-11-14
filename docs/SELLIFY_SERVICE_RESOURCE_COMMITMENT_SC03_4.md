# SC-03.4 — Service Booking Resource Commitment

Status: implementation draft; validation pending.

## Authority boundary

Service Booking remains the canonical appointment lifecycle and commitment record. This increment does **not** introduce a second reservation/calendar table or a new Logistics authority.

The existing `service_bookings` row now carries nullable `service_resource_id`. A booking becomes a resource commitment only when the server accepts the `ACCEPTED → CONFIRMED` transition with an explicit resource. The same transaction changes booking status, binds the resource, writes the idempotency command, and records audit evidence.

Canonical flow:

`Service Request → Service Resource → Declared Working Window → Feasibility → Authorized Confirmation → Resource Commitment`

## Confirmation checks

Inside the existing SQLite `BEGIN IMMEDIATE` transaction, confirmation:

1. Verifies the booking is still at the expected version and the command is not a conflicting replay.
2. Requires an explicit `service_resource_id`; customer booking creation cannot assign a resource.
3. Verifies the resource belongs to the same tenant and organization and is ACTIVE.
4. Verifies an optional Catalog service binding matches the booking's service item.
5. Verifies an on-site resource's location against the canonical order location; missing or mismatched location evidence fails closed.
6. Requires a stored Service Resource working-hours declaration and a valid IANA timezone.
7. Evaluates the requested interval against declared hours and date exceptions. UNKNOWN or outside-hours results are rejected.
8. Checks half-open interval overlap against other CONFIRMED/IN_PROGRESS bookings for that resource.
9. Checks overlapping legacy CONFIRMED/IN_PROGRESS bookings with no resource assignment. These are UNKNOWN commitments and block new confirmations until resolved.
10. Updates the booking, stores the resource binding, and writes audit evidence before commit.

The overlap predicate is `existing.start < requested.end AND existing.end > requested.start`. The write lock serializes competing confirmation commands; exactly one can claim a conflicting resource interval.

## Commitment states

- REQUESTED / ACCEPTED: `NOT_COMMITTED`.
- CONFIRMED / IN_PROGRESS with a resource: `COMMITTED`.
- Legacy CONFIRMED / IN_PROGRESS without a resource: `UNKNOWN`.
- CANCELLED / FAILED / COMPLETED after a resource binding: `RELEASED`.

UNKNOWN is not treated as free capacity. Legacy unassigned commitments block overlapping confirmations for any resource because their actual resource is not known.

## UI

- Owner/Manager see the booking workspace and resource administration.
- Confirmation requires selecting an ACTIVE resource with a declared schedule.
- The workspace displays the resource assignment and commitment state.
- Provider continues to manage only its assigned resource's declared schedule.
- Logistics-only roles do not see or operate Service Booking.
- Customer-facing appointment discovery/request/status UI is not part of this increment.

## Semantics and limits

- Declared working hours are evidence for schedule feasibility, not independent verification of real-world provider availability.
- A successful confirmation is the authoritative Service Booking resource commitment.
- Preparation/acceptance does not commit a resource.
- UNKNOWN, missing schedule, invalid timezone, out-of-hours requests, resource mismatch, and conflicts fail closed.
- Cross-local-date windows remain UNKNOWN in the current pure schedule evaluator.
- No offline command is represented as server-confirmed execution.
- No Order, Payment, Inventory, Fulfillment, or Logistics lifecycle is mutated.

## Validation plan

- Migration 80 continuity and schema regression.
- Missing resource, missing schedule, out-of-hours, resource mismatch, and legacy UNKNOWN regressions.
- Same-resource overlap and concurrent confirmation race.
- Idempotency replay and conflict semantics.
- Cancellation/completion release semantics.
- Audit evidence and no Logistics Scheduling activity.
- Manager UI resource selection, required-selection guard, and Provider resource-only workspace.
