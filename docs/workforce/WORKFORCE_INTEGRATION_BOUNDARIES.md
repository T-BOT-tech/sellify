# Workforce Integration Boundaries

## Service Booking

Service Booking remains the only booking authority. Workforce does not create bookings, transition bookings independently, or bypass Service Booking authorization.

A Service Booking may reference a Workforce member only during the existing authorized confirmation transition and only when all of the following hold:

1. The member is ACTIVE and belongs to the same organization and tenant as the booking.
2. The member's canonical User still has an active membership in that tenant.
3. The member has an ACTIVE assignment to the selected Service Resource.
4. The assignment covers the complete requested appointment interval and, when specified, matches the resource location.
5. The member has an ACTIVE availability window whose availability value is AVAILABLE.
6. The availability window covers the complete requested appointment interval and is compatible with the selected resource and location.
7. The booking passes the existing Service Booking authorization and lifecycle checks.
8. The existing Service Resource Commitment model creates the canonical resource commitment.

Migration 87 adds only a nullable workforce_member_id reference to service_bookings. It does not add a second booking table or commitment authority.

The Workforce member identifier is included in Service Booking idempotency fingerprints. Direct booking creation with a Workforce member reference is rejected; the reference is accepted only on confirmation.

Provider appointment reads require a matching Workforce member user identity. A provider cannot see another member's linked appointments or assignments, even when multiple providers share a Service Resource. Legacy appointments without a Workforce member link are not exposed in provider queues because their owner cannot be established safely.

## Service Availability

The existing Service Availability contract remains configuration-only. It does not claim a resource is free, evaluate appointment conflicts, reserve time, or confirm a booking.

Workforce availability is potential member capacity. Service Booking confirmation checks both the existing Service Resource availability and the member's Workforce availability/assignment evidence. Neither availability record is itself a booking or commitment.

The current booking eligibility check requires concrete, timezone-aware start and end timestamps. Stored recurrence rules are not expanded or evaluated by this integration.

## Service Resource Commitment

The existing Service Resource Commitment model remains the canonical resource commitment authority.

Workforce may associate an eligible member with a booking, but it does not create a second resource commitment. Workforce allocations represent member-capacity allocation and remain a separate Workforce record.

## Supplier Network

Supplier capacity remains owned by Supplier Network.

Workforce may consume supplier capacity evidence; it must not duplicate supplier capacity, supplier identity, or supplier commitments.

## Procurement

Procurement remains the authority for demand, assessment, authorization, and commitment.

Workforce may reference existing operational work where authorized, but it must not become a second procurement demand or commitment system.

## Logistics

Logistics Scheduling remains request-only.

Workforce may reference an existing operational task identifier, but it must not create logistics tasks, assign logistics execution, or bypass the existing Logistics authority.

## Catalog

Catalog/Product remains the authority for product identity.

Workforce must not create products, services, or catalog entries.

## Tenant and organization boundaries

Every Workforce row is scoped by organization_id, tenant_id, and chat_id. Parent references are validated against the same organization and tenant. Cross-tenant and cross-organization access is denied.

A Service Provider's Workforce reads are read-only, restricted to active assigned Service Resources and their own Workforce member identity.
