# Workforce Implementation Plan

## Phase 1: Design and contracts

- Workforce capability map.
- Authorization map.
- Data model.
- Integration boundaries.
- Implementation plan.

## Phase 2: Persistence foundation

- Workforce member table.
- Workforce profile table.
- Engagement table.
- Migration guards.
- Organization-scoped indexes.
- Foreign keys.

## Phase 3: Member lifecycle

- Create member.
- List members.
- Get member.
- Update member.
- Activate member.
- Suspend member.
- Deactivate member.
- Authorization.
- Idempotency.
- Optimistic concurrency.

## Phase 4: Profile and engagement

- Create and update profile.
- Create and update engagement.
- Effective dating.
- Approval state.
- Audit provenance.

## Phase 5: Calendar and availability

- Working calendar.
- Time-zone correctness.
- Recurrence.
- Holidays.
- Leave.
- Exceptions.
- Availability windows.
- Availability status.

## Phase 6: Assignment and shifts

- Assign member to location.
- Assign member to service resource.
- Create shift.
- Confirm shift.
- Cancel shift.
- Resource-scoped authorization.

## Phase 7: Service Booking integration

- Eligible workforce member selection.
- Booking reference.
- Commitment creation through existing resource-commitment model.
- Provider appointment isolation.
- Logistics request-only boundary.

## Phase 8: Allocation and utilization

- Allocation lifecycle.
- Release allocation.
- Utilization event.
- Planned versus actual time.
- Variance.

## Acceptance criteria

The first slice is complete only when:

- A workforce member can be created for an existing user and organization.
- The member can be activated, suspended, and deactivated with authorization.
- A profile can store skills, qualifications, and service capabilities.
- A calendar can define time-zone-aware availability.
- Availability can be created, updated, and expired safely.
- A member can be assigned to a service resource.
- A service booking can reference an assigned workforce member.
- A commitment is created only through the existing resource-commitment model.
- Provider appointment isolation remains intact.
- Logistics Scheduling remains request-only.
- All mutations are authorized, idempotent where required, versioned, and audited.
- Regressions cover authorization, tenant isolation, availability, booking integration, and commitment integrity.
