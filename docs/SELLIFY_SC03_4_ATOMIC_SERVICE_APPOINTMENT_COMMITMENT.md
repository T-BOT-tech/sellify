# SC-03.4 — Atomic Service Appointment Commitment

**Status:** Implementation candidate on `feat/sc03-service-atomic-appointment-commitment`  
**Authority:** Service Pack / Service Booking  
**Depends on:** SC-03.1 Service Resource Foundation, SC-03.2 declared working hours, SC-03.3 declared-window assessment and resource-scoped Provider access.

## Boundary

This is a Service-owned appointment commitment, not a general reservation platform and not Logistics Scheduling. The authority chain is:

`Service Booking → Service Resource → declared working hours → conflict recheck → atomic resource commitment`

The existing canonical Order remains the commercial/order reference. Appointment confirmation does not mutate Commerce, Payment, Inventory, Fulfillment, or Logistics state, and does not create Logistics Scheduling activities.

## Confirmation contract

A booking can move from `ACCEPTED` to `CONFIRMED` only when the command supplies an explicit `resource_id`. Within one SQLite `BEGIN IMMEDIATE` transaction, the store:

1. Re-reads the tenant and booking in the owning organization.
2. Resolves an ACTIVE Service Resource in that same tenant and organization.
3. Validates optional Catalog service binding and canonical order location compatibility.
4. Re-reads the resource's current declared working hours and date exceptions.
5. Re-evaluates the booking interval against those declarations. Missing/unknown schedule or out-of-hours requests fail closed.
6. Checks existing ACTIVE commitments for interval overlap (`existing.starts_at < requested.ends_at && existing.ends_at > requested.starts_at`).
7. Updates the booking to `CONFIRMED`, binds its resource, inserts exactly one resource commitment, stores the idempotency command and writes audit evidence before commit.

The transaction serializes competing confirmations. A losing command receives `SERVICE_BOOKING_RESOURCE_CONFLICT`; it is not represented as success. Replaying the same command returns the same booking and does not create a second commitment. The resource ID is included in the idempotency fingerprint.

## Commitment lifecycle and protection

- `CANCELLED` and `FAILED` release an ACTIVE commitment.
- `COMPLETED` marks its commitment COMPLETED for history.
- A resource with active commitments cannot be deactivated, reassigned to another service item, or moved to another location.
- Working-hours changes are rejected if they would put an existing confirmed appointment outside the new declarations.
- Resource commitments remain Service-owned and scoped to a single Service Resource; there is no global calendar or cross-domain reservation authority.

## Authorization and UI

- `service:appointment:commit` is a registered central authorization permission.
- Manager and Owner receive the permission through the existing central authorization evaluator.
- Service Provider and Logistics Dispatcher do not receive appointment-commit authority from this change.
- The existing Service Booking operator workspace asks the Manager/Owner to select an eligible active Service Resource before confirmation and sends its ID with the idempotent transition.
- Conflict, invalid resource, missing schedule, and out-of-hours errors remain explicit failures; no optimistic “confirmed” UI state is shown.

## Persistence

Migration 80 adds the optional Service Resource reference to existing booking rows and the Service-owned `service_resource_commitments` table. Existing unconfirmed booking rows remain valid. The commitment table has one row per booking and an overlap lookup index.

## Regression coverage

The persistence regression exercises resource-bound confirmation, missing resource rejection, out-of-hours rejection, idempotent replay, serialized competing confirmations, explicit overlap conflict, release-and-retry, active-commitment protection against resource deactivation and schedule changes, and unchanged Commerce/Payment/Fulfillment/Logistics state.

The Node >=24 CI baseline remains the runtime gate. This document does not certify a merge or production readiness before the latest commit's CI is green.
