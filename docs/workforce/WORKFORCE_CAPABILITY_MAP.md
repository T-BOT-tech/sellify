# Workforce Capability Map

## Purpose

Workforce provides organization-scoped people, engagement, calendar, availability, assignment, allocation, and utilization capabilities.

It reuses existing canonical authorities. It does not replace User identity, Organization/Tenant membership, Service Resource, Service Availability, Service Booking, Supplier Network, Procurement, Logistics, Inventory, Payment, or Catalog.

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
| Working calendar and shifts | Workforce |
| Workforce availability | Workforce, integrated with Service Availability |
| Workforce assignment | Workforce |
| Workforce allocation | Workforce, integrated with existing commitment model |
| Workforce utilization | Workforce |

## Core concepts

- **Workforce member**: an organization-scoped relationship between an existing user and an organization.
- **Workforce profile**: skills, qualifications, service capabilities, languages, and visibility.
- **Engagement**: employment, contractor, provider, volunteer, or internal assignment relationship.
- **Working calendar**: time zone, recurring working hours, holidays, leave, and exceptions.
- **Availability window**: potential availability; never a confirmed booking.
- **Shift**: a concrete scheduled work period.
- **Assignment**: assignment of a member to a location, resource, team, booking, or operational task.
- **Allocation**: an approved commitment that consumes availability.
- **Utilization**: actual work performed, separate from declared availability.

## Boundary rules

- A workforce member is a relationship between an existing user and an organization.
- A user may belong to multiple organizations.
- Workforce membership is organization-scoped.
- Availability is potential capacity, not a booking.
- A shift is scheduled work.
- A commitment is an approved allocation.
- Utilization is actual work, separate from declared availability.
- Supplier capacity remains owned by Supplier Network.
- Service Booking remains owned by Service Booking.
- Logistics Scheduling remains request-only.
- Procurement remains the authority for demand, assessment, authorization, and commitment.
- Catalog/Product remains the authority for product identity.

## Initial scope

The first implementation slice includes:

1. Workforce member lifecycle.
2. Workforce profile.
3. Engagement.
4. Working calendar.
5. Availability windows and exceptions.
6. Workforce assignment to a service resource.
7. Authorization.
8. Persistence and migrations.
9. Service Booking integration regression.
10. Documentation.

Shift recurrence, utilization analytics, advanced approval workflows, and cross-domain allocation are later increments.
