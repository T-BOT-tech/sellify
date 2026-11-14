# SC-03.3 — Service Provider Resource-Scoped Access

**Implementation boundary:** Service Pack contextual identity and Provider self-service working-hours access.

## Existing authorities reused

- Identity: existing users, memberships, sessions and devices.
- Membership/role persistence: existing `membership_roles`.
- Resource ownership target: existing `service_resources`.
- Authorization evaluator: `backend/lib/authorization.js`.
- Tenant/location enforcement: existing `tenant-isolation.js` and server route boundary.
- Audit: existing `audit_events` / `recordAuditEvent`.
- Availability declaration: existing Service Resource Availability contract/store/API from SC-03.2.

No new identity, role store, resource ownership database, availability authority, or Logistics authority is introduced.

## Provider assignment

A provider is invited through the existing staff invitation path and receives a base `staff` membership. An Org Admin or Manager then assigns the contextual-only `service_provider` role to one exact Service Resource using the existing contextual membership-role API.

The assignment is stored in `membership_roles` as:

- `role_id = service_provider`
- `scope_type = RESOURCE`
- `scope_id = service_resources.id`

Guardrails:
- Service Pack must be ACTIVE.
- Target membership must be an active `staff` membership in the same tenant.
- The resource must belong to the same canonical organization and tenant.
- `service_provider` cannot be assigned at organization or location scope.
- Other roles cannot use RESOURCE scope through this Service-specific contract.
- Assignment and revocation use the existing membership role audit lifecycle.

## Central resource-context authorization

The canonical evaluator accepts an optional sixth argument, `resourceContext`. A resource-scoped role becomes effective only when all of these match:

- `resourceType = service_resource`
- exact `resourceId = membership_roles.scope_id`
- `organizationId = authenticated tenant organization`
- `locationId = canonical resource location` (including null for organization-wide resources)

The server resolves the resource from `service_resources` before constructing this context. Missing, mismatched, foreign-organization, or wrong-resource-type contexts fail closed.

The Provider role is contextual-only and is explicitly rejected as a base membership role.

## Provider capabilities

Allowed:
- View only assigned active Service Resources.
- View and update declared working hours and date exceptions for assigned resources.
- Use the local declared-window assessment UI.

Not allowed:
- Create, rename, activate, deactivate, or move Service Resources.
- Assign or revoke membership roles.
- Access other providers' resources.
- Manage bookings or appointment commitments in this increment.
- Access Logistics Scheduling, delivery assignments, or courier workflows.

The Provider workspace hides the unrelated Service Booking operator list and presents only assigned resources and availability controls.

## Availability semantics remain conservative

Working hours and date exceptions are declarations. A window match means only that the requested interval fits the declared schedule. Existing appointments/resource commitments are not evaluated here. The result remains `UNKNOWN` for capacity, does not confirm availability, does not authorize booking, and does not reserve a slot.

## Regression coverage

- Exact resource, organization, location, and type matching.
- Denial without context, with wrong resource ID, wrong organization, wrong type, or wrong location.
- No Provider resource-metadata permissions and no Logistics permissions.
- Staff-only membership assignment; no organization-scoped Provider assignment.
- Foreign-tenant resource assignment rejected.
- Service Pack deactivation removes Provider context from new and existing authenticated sessions.
- Manager assignment/revocation UI and Provider-only availability workspace.
- All 13 locale files define Provider controls exactly once.

## Deferred

- Customer-facing appointment discovery/request journey.
- Resource-level overlap/commitment feasibility.
- Atomic booking/resource-slot commitment.
- Provider appointment lifecycle actions.

These require the next SC-03 boundaries and must not be inferred from a working-hours declaration.
