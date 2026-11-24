# Workforce Data Model

## Principles

Workforce adds workforce-specific tables only.

It must not duplicate:

- `users`
- `organizations`
- `tenants`
- `service_resources`
- `service_bookings`
- `service_resource_commitments`
- `supplier_network_capacity`

## Entities

### workforce_members

```text
id
organization_id
chat_id
user_id
member_type
status
primary_location_id
timezone
display_name
created_at
updated_at
version
```

Member types:

- `EMPLOYEE`
- `CONTRACTOR`
- `PROVIDER`
- `VOLUNTEER`

Statuses:

- `DRAFT`
- `ACTIVE`
- `SUSPENDED`
- `INACTIVE`

### workforce_profiles

```text
id
organization_id
chat_id
member_id
skills
qualifications
languages
service_capabilities
visibility
notes
effective_from
effective_until
created_at
updated_at
version
```

### workforce_engagements

```text
id
organization_id
chat_id
member_id
engagement_type
status
starts_at
ends_at
approver_user_id
terms_reference
created_at
updated_at
version
```

Engagement types:

- `EMPLOYMENT`
- `CONTRACT`
- `PROVIDER_RELATIONSHIP`
- `VOLUNTEER`
- `INTERNAL_ASSIGNMENT`

### workforce_calendars

```text
id
organization_id
chat_id
member_id
location_id
timezone
weekly_schedule
holiday_calendar
effective_from
effective_until
status
created_at
updated_at
version
```

### workforce_calendar_exceptions

```text
id
organization_id
chat_id
calendar_id
exception_type
starts_at
ends_at
all_day
reason
created_at
updated_at
version
```

Exception types:

- `HOLIDAY`
- `LEAVE`
- `BLACKOUT`
- `TEMPORARY_CHANGE`

### workforce_availability_windows

```text
id
organization_id
chat_id
member_id
resource_id
location_id
availability
starts_at
ends_at
timezone
recurrence_rule
effective_from
effective_until
status
created_at
updated_at
version
```

Availability values:

- `AVAILABLE`
- `UNAVAILABLE`
- `TENTATIVE`
- `BLACKOUT`

### workforce_shifts

```text
id
organization_id
chat_id
member_id
resource_id
location_id
starts_at
ends_at
timezone
break_rules
status
recurrence_source_id
assignment_source_id
created_at
updated_at
version
```

Shift statuses:

- `PLANNED`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### workforce_assignments

```text
id
organization_id
chat_id
member_id
resource_id
location_id
assignment_type
status
starts_at
ends_at
booking_id
operational_task_id
created_at
updated_at
version
```

### workforce_allocations

```text
id
organization_id
chat_id
member_id
resource_id
booking_id
operational_task_id
starts_at
ends_at
state
committed_by
committed_at
created_at
updated_at
version
```

### workforce_utilization_events

```text
id
organization_id
chat_id
member_id
resource_id
booking_id
operational_task_id
planned_starts_at
planned_ends_at
actual_starts_at
actual_ends_at
status
evidence_source
created_at
updated_at
version
```

## Migration rules

- Use additive migrations only.
- Preserve existing canonical tables.
- Use foreign keys and organization-scoped indexes.
- Use migration version guards.
- Do not alter existing service, supplier, procurement, logistics, or catalog tables unless integration requires a narrowly scoped additive reference.
