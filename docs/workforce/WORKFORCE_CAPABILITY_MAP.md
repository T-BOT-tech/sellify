# Workforce Capability Map

## Purpose

Workforce provides organization-scoped people, engagement, profile, calendar, availability, assignment, shift, allocation, and utilization capabilities.

It reuses existing canonical authorities. It does not replace User identity, Organization/Tenant membership, Service Resource, Service Availability, Service Booking, Supplier Network, Procurement, Logistics, Inventory, Payment, Fulfillment, or Catalog.

## Canonical ownership

| Responsibility | Owner |
|---|---|
| Person identity | Existing User identity |
| Organization and tenant membership | Existing Organization/Tenant authority |
| Service resource identity | Existing Service Resource authority |
| Service availability configuration | Existing Service Availability authority |
| Service booking lifecycle | Existing Service Booking authority |
| Resource commitment | Existing Service Resource Commitment model |
| Supplier capacity evidence | Existing Supplier Network capacity authority |
| Procurement demand, feasibility, authorization, and commitment | Existing Procurement authority |
| Logistics scheduling | Existing Logistics authority, request-only |
| Product identity | Existing Catalog/Product authority |
| Workforce membership and profile | Workforce |
| Engagement | Workforce |
| Working calendar and calendar exceptions | Workforce |
| Workforce availability windows | Workforce, coordinated with Service Availability |
| Shifts and member assignments | Workforce |
| Member allocations | Workforce; distinct from canonical Service Resource Commitment |
| Workforce utilization | Workforce |

## Core concepts

- **Workforce member**: an organization-scoped relationship between an existing user and an organization.
- **Workforce profile**: skills, qualifications, service capabilities, languages, and visibility.
- **Engagement**: employment, contractor, provider, volunteer, or internal assignment relationship.
- **Working calendar**: time zone, recurring schedule data, holidays, leave, and exceptions.
- **Availability window**: potential availability; never a confirmed booking.
- **Shift**: a concrete scheduled work period.
- **Assignment**: assignment of a member to a location or Service Resource, with optional references to an existing booking or operational task.
- **Allocation**: an approved allocation of member capacity. It is not a second Service Resource Commitment.
- **Utilization**: actual work performed, separate from declared availability.

## Boundary rules

- A workforce member references an existing User; it does not create a second identity.
- A user may belong to multiple organizations.
- Workforce membership is organization- and tenant-scoped.
- Availability is potential capacity, not a booking or reservation.
- A shift is scheduled work.
- A commitment is an approved allocation; canonical Service Resource commitments remain owned by Service Resource Commitment.
- Utilization is actual work, separate from declared availability.
- Supplier capacity remains owned by Supplier Network.
- Service Booking remains owned by Service Booking.
- Logistics Scheduling remains request-only.
- Procurement remains the authority for demand, assessment, authorization, and commitment.
- Catalog/Product remains the authority for product identity.

## Implementation status

Implemented and regression-verified on 2026-11-24.

### Persistence

- Additive migration 86: runWorkforceSqliteMigrations.
- Additive migration 87: runWorkforceServiceBookingMigration.
- Ten Workforce tables: members, profiles, engagements, calendars, calendar exceptions, availability windows, assignments, shifts, allocations, and utilization events.
- Organization, tenant, user, location, Service Resource, and Service Booking references reuse existing canonical tables.
- Version, idempotency, audit provenance, and organization/tenant indexes are included.

### Repository

backend/lib/workforce-sqlite-repository.js exports WorkforceSqliteRepository.

It provides organization- and tenant-scoped create, get, list, and update, plus entity-specific lifecycle operations:

- Member: activate, suspend, deactivate.
- Engagement: submit, activate, suspend, end.
- Calendar exception: cancel.
- Assignment: activate, suspend, end.
- Shift: confirm, start, complete, cancel.
- Allocation: submit, approve, release, cancel.
- Utilization: start, complete, cancel.

Calendar and availability records use CRUD; availability state is expressed by the availability value, not a booking state.

The production store exposes createWorkforceSqliteRepository() and binds it to the central authorization adapter.

### API

Authenticated routes are registered under /tenants/:chatId/workforce/:entity:

- GET list and GET /:id.
- POST create.
- PATCH /:id update.
- POST /:id/:action for supported entity lifecycle operations.

Entity slugs: members, profiles, engagements, calendars, calendar-exceptions, availability, assignments, shifts, allocations, and utilization.

API payload allowlists and contract validation reject unsupported fields, invalid time windows, missing idempotency keys, and invalid expected versions.

### Authorization and Service Booking

- Workforce permissions are registered in the existing authorization system.
- Manager and owner access follows the existing role policy.
- Service Provider access is read-only and requires an active resource-scoped role, the assigned Service Resource, and the provider's own Workforce identity.
- Service Booking may store a Workforce member reference only during authorized confirmation.
- Member eligibility requires an active member, active canonical membership, active assignment, and an available window covering the full booking interval.
- The existing Service Resource Commitment model still creates the canonical resource commitment.
- Provider appointment reads filter linked bookings by Workforce member identity.

## Remaining scope and limitations

- Workforce UI and operator workflows are not included in this persistence/API increment.
- Recurrence rules are stored but are not evaluated by the Service Booking eligibility check; that check requires concrete availability windows with explicit start and end timestamps.
- Utilization analytics and planned-versus-actual reporting remain future work.
- The allocation API is implemented, but Service Booking does not create a second Workforce allocation record; the booking reference and canonical resource commitment remain the integration evidence.
- Legacy provider appointments without a Workforce member link are hidden from provider appointment queues until ownership can be established.
- Payroll, HRIS, supplier-capacity ownership, and logistics-task execution are outside this capability.
