# Workforce Authorization Map

## Principles

Workforce authorization uses Sellify's existing authorization and tenant-isolation authorities. It does not introduce a second role registry.

Every repository operation requires:

- An authenticated tenant session.
- Organization and tenant scope.
- A central permission decision.
- Resource scope where applicable.
- Idempotency for create operations.
- Expected-version checks for mutations.
- Audit provenance.

The SQLite repository validates the canonical tenant-to-organization-to-chat mapping before reading or writing records. User and member references are validated against existing users and active tenant memberships.

## Registered permissions

These permissions are registered in backend/lib/authorization.js and mapped by backend/lib/workforce-authorization-adapter.js.

| Permission | Use |
|---|---|
| workforce:member:view | Read members |
| workforce:member:manage | Create/update/deactivate members |
| workforce:member:activate | Activate a member |
| workforce:member:suspend | Suspend a member |
| workforce:profile:view | Read profiles |
| workforce:profile:manage | Create/update profiles |
| workforce:engagement:view | Read engagements |
| workforce:engagement:manage | Create/update and transition engagements |
| workforce:calendar:view | Read calendars and calendar exceptions |
| workforce:calendar:manage | Create/update calendars and manage exceptions |
| workforce:availability:view | Read availability windows |
| workforce:availability:manage | Create/update availability windows |
| workforce:assignment:view | Read assignments and shifts |
| workforce:assignment:manage | Create/update assignments and manage shift lifecycle |
| workforce:allocation:view | Read allocations |
| workforce:allocation:manage | Create/update, submit, and approve allocations |
| workforce:allocation:release | Release an approved allocation |
| workforce:utilization:view | Read utilization events |
| workforce:utilization:manage | Create/update and transition utilization events |

There are no separate shift or calendar-exception permissions in this increment: shifts use assignment permissions, and calendar exceptions use calendar permissions.

## Role mapping

- Owner access follows the existing owner wildcard policy.
- Manager receives the Workforce management permissions listed above.
- Service Provider receives only read permissions for own member/profile/calendar/availability/assignment data.
- Staff and other roles do not receive Workforce permissions by default.

Service Provider contextual access is effective only when the existing authorization system confirms an exact active Service Resource context. The repository additionally filters provider reads by the provider's own Workforce member identity.

## Scope enforcement

Workforce access must respect:

- Organization scope.
- Tenant and chat scope.
- Location scope where applicable.
- Service Resource scope for resource-bound availability, assignments, shifts, allocations, and utilization.
- Member ownership for provider-facing records.
- Booking ownership for provider appointment reads.

A provider must not see another provider's appointments or assignments. Provider appointment queries require a Workforce member link matching the authenticated provider user; unlinked legacy appointments are not exposed in provider queues.

Cross-tenant and cross-organization reads return not-found behavior. Resource-scoped reads are constrained to the exact assigned resource. Identity and parent-reference fields are create-only so a record cannot be moved between users, members, calendars, bookings, or operational tasks through a normal update.

## Service Booking authorization

Service Booking remains the authority for booking creation, lifecycle, and authorization.

Workforce member linkage is accepted only during authorized Service Booking confirmation. The request must pass the existing Service Booking authorization and lifecycle checks plus Workforce assignment-management authorization. The store verifies member eligibility before writing the reference.

The canonical Service Resource Commitment model creates the resource commitment. Workforce does not create a second booking or resource-commitment authority.

## Logistics boundary

Logistics Scheduling remains request-only.

Workforce may reference an existing operational task identifier, but it cannot create logistics tasks or bypass Logistics authorization.
