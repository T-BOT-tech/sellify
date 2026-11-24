# Workforce Authorization Map

## Principles

Workforce authorization is organization-scoped.

Every workforce mutation requires:

- Tenant session.
- Organization scope.
- Permission check.
- Idempotency key where appropriate.
- Optimistic concurrency version.
- Audit provenance.

## Permissions

Add these permissions to the existing authorization registry:

```text
workforce:member:view
workforce:member:manage
workforce:member:activate
workforce:member:suspend

workforce:profile:view
workforce:profile:manage

workforce:engagement:view
workforce:engagement:manage

workforce:calendar:view
workforce:calendar:manage

workforce:shift:view
workforce:shift:manage
workforce:shift:confirm
workforce:shift:cancel

workforce:availability:view
workforce:availability:manage

workforce:assignment:view
workforce:assignment:manage

workforce:allocation:view
workforce:allocation:manage
workforce:allocation:release

workforce:utilization:view
workforce:utilization:manage
```

## Resource scope

Workforce permissions must respect:

- Organization scope.
- Tenant scope.
- Location scope where applicable.
- Service-resource scope where applicable.
- Provider resource-scoped assignment isolation.

A provider must not see another provider’s appointments or assignments.

## Integration permissions

Service Booking remains the authority for booking lifecycle.

Workforce may provide an eligible member, but it must not create a booking or bypass Service Booking authorization.

Logistics Scheduling remains request-only.

Workforce may provide available personnel or resources, but it must not create logistics tasks or bypass the existing logistics authority.
