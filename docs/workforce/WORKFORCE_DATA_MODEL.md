# Workforce Data Model

## Principles

Workforce adds workforce-specific tables only. It reuses the canonical User, Organization, Tenant, Location, Service Resource, and Service Booking records.

It must not duplicate:

- users
- organizations
- tenants
- service_resources
- service_bookings
- service_resource_commitments
- supplier_network_capacity
- logistics task or scheduling authorities
- catalog/product tables

Every Workforce table carries organization_id, tenant_id, and chat_id. Organization and tenant scope are validated together by the repository. All mutable records carry created_at, updated_at, and version. Create operations carry an idempotency_key and request_hash; creator/updater provenance references existing users.

## Entities and persisted fields

### workforce_members

- id
- organization_id, tenant_id, chat_id
- user_id
- member_type
- status
- primary_location_id
- timezone
- display_name
- employee_number
- department_id, position_id, supervisor_member_id
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Member types: EMPLOYEE, CONTRACTOR, PROVIDER, VOLUNTEER.

Statuses: DRAFT, ACTIVE, SUSPENDED, INACTIVE.

user_id references the existing users table. Initial linking is accepted during member creation; later link/unlink uses explicit authorized and audited actions. A linked user must have active membership in the tenant, and one Sellify user cannot be linked to multiple Workforce members in the same organization/tenant scope.

### workforce_profiles

- id
- organization_id, tenant_id, chat_id
- member_id
- skills_json, qualifications_json, languages_json, service_capabilities_json
- visibility
- notes
- effective_from, effective_until
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

JSON columns are exposed by the repository as skills, qualifications, languages, and service_capabilities arrays.

Visibility values: PRIVATE, ORGANIZATION, LOCATION, PUBLIC.

member_id is immutable after creation.

### workforce_engagements

- id
- organization_id, tenant_id, chat_id
- member_id
- engagement_type
- status
- starts_at, ends_at
- approver_user_id
- terms_reference
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Engagement types: EMPLOYMENT, CONTRACT, PROVIDER_RELATIONSHIP, VOLUNTEER, INTERNAL_ASSIGNMENT.

Lifecycle states: DRAFT, PENDING_APPROVAL, ACTIVE, SUSPENDED, ENDED.

### workforce_calendars

- id
- organization_id, tenant_id, chat_id
- member_id
- location_id
- timezone
- weekly_schedule_json, holiday_calendar_json
- effective_from, effective_until
- status
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Repository/API fields weekly_schedule and holiday_calendar are JSON arrays. Calendar status is ACTIVE or INACTIVE. member_id is immutable after creation.

### workforce_calendar_exceptions

- id
- organization_id, tenant_id, chat_id
- calendar_id
- exception_type
- starts_at, ends_at
- all_day
- reason
- status
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Exception types: HOLIDAY, LEAVE, BLACKOUT, TEMPORARY_CHANGE.

Status is ACTIVE or CANCELLED. calendar_id is immutable after creation.

### workforce_availability_windows

- id
- organization_id, tenant_id, chat_id
- member_id
- resource_id
- location_id
- availability
- starts_at, ends_at
- timezone
- recurrence_rule
- effective_from, effective_until
- status
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Availability values: AVAILABLE, UNAVAILABLE, TENTATIVE, BLACKOUT.

### Availability recurrence semantics

- A null or empty recurrence_rule represents the existing one-time starts_at/ends_at interval.
- Recurring windows use a bounded RRULE subset: FREQ=DAILY or WEEKLY, optional INTERVAL (1–366), WEEKLY-only BYDAY (MO,TU,WE,TH,FR,SA,SU), and either COUNT (1–10000) or UNTIL (YYYYMMDD or YYYYMMDDTHHmmssZ).
- starts_at is DTSTART. Its local date and wall-clock time are interpreted in the record's IANA timezone; ends_at supplies the local end time for each occurrence.
- effective_from and effective_until bound occurrence dates inclusively.
- Weekly rules default BYDAY to the weekday of DTSTART. COUNT includes DTSTART when it matches the rule.
- Recurring windows must begin and end on the same local date. Overnight recurrence windows, monthly/yearly rules, ordinal BYDAY, and other RFC 5545 features are not supported.
- Invalid or unsupported recurrence rules and nonexistent local times fail closed for booking eligibility. The evaluator checks the complete requested appointment interval and preserves local wall-clock time across daylight-saving changes.
- This is a Workforce availability projection only; it does not replace Service Resource Availability or Service Resource Commitment authority.

Record status is ACTIVE or INACTIVE. Availability is potential capacity, not a booking. member_id is immutable after creation.

### workforce_assignments

- id
- organization_id, tenant_id, chat_id
- member_id
- resource_id
- location_id
- assignment_type
- status
- starts_at, ends_at
- booking_id
- operational_task_id
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Assignment types: LOCATION, RESOURCE, BOOKING, OPERATIONAL_TASK.

Statuses: DRAFT, ACTIVE, SUSPENDED, ENDED.

member_id, booking_id, and operational_task_id are immutable after creation. booking_id references the existing Service Booking. operational_task_id is an opaque reference; Workforce does not create or own Logistics tasks.

### workforce_shifts

- id
- organization_id, tenant_id, chat_id
- member_id
- resource_id
- location_id
- starts_at, ends_at
- timezone
- break_rules_json
- status
- recurrence_source_id
- assignment_source_id
- shift_template_id, template_version, generated_local_date
- constraint_policy_id, constraint_policy_version, constraint_state, constraint_findings_json
- constraint_override_reason, constraint_override_by, constraint_override_at
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Repository/API field break_rules is stored as JSON. Statuses: PLANNED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED.

recurrence_source_id, assignment_source_id, and shift_template_id are immutable after creation. A member change is permitted only through the explicit audited reassign action, which rechecks active engagement, location eligibility, leave/absence, and scheduling constraints; generic updates cannot change member_id.

### workforce_allocations

- id
- organization_id, tenant_id, chat_id
- member_id
- resource_id
- booking_id
- operational_task_id
- starts_at, ends_at
- state
- committed_by, committed_at
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

States: DRAFT, PENDING_APPROVAL, COMMITTED, RELEASED, CANCELLED.

member_id, booking_id, and operational_task_id are immutable after creation. This is a member-capacity allocation record, not a duplicate Service Resource Commitment.

### workforce_utilization_events

- id
- organization_id, tenant_id, chat_id
- member_id
- resource_id
- booking_id
- operational_task_id
- planned_starts_at, planned_ends_at
- actual_starts_at, actual_ends_at
- status
- evidence_source
- idempotency_key, request_hash
- created_by, updated_by
- created_at, updated_at, version

Statuses: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED.

member_id, booking_id, and operational_task_id are immutable after creation. Utilization records actual work; it is not declared availability.

### Organization structure and shift templates (migrations 90–96)

#### workforce_departments
- id, organization_id, tenant_id, chat_id
- code, name, description, status
- idempotency_key, request_hash, created_by, updated_by
- created_at, updated_at, version

#### workforce_positions
- id, organization_id, tenant_id, chat_id
- code, name, description, department_id, classification, status
- idempotency_key, request_hash, created_by, updated_by
- created_at, updated_at, version

#### workforce_shift_templates
- id, organization_id, tenant_id, chat_id
- name, start_local_time, end_local_time, timezone
- break_rules_json, work_days_json
- department_id, position_id, location_id
- effective_from, effective_until, status
- idempotency_key, request_hash, created_by, updated_by
- created_at, updated_at, version

Templates generate dated Workforce shifts; they do not become a separate scheduling authority. Generated shifts retain template ID/version and local-date provenance.

### Leave, absence, and scheduling policy (migrations 97–100)

#### workforce_leave_requests
- id, organization_id, tenant_id, chat_id, member_id
- leave_category, status, starts_at, ends_at, timezone, all_day, reason
- requested_by, submitted_by, submitted_at
- decided_by, decided_at, decision_reason
- withdrawn_by, withdrawn_at, withdrawal_reason
- cancelled_by, cancelled_at, cancellation_reason
- idempotency_key, request_hash, created_at, updated_at, version

Leave lifecycle: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, WITHDRAWN, CANCELLED. Approval is an audited lifecycle decision and checks active engagement plus existing approved leave and scheduled shifts.

#### workforce_absences
- id, organization_id, tenant_id, chat_id, member_id
- absence_type, status, starts_at, ends_at, timezone, all_day, reason
- recorded_by, voided_by, voided_at, void_reason
- idempotency_key, request_hash, created_at, updated_at, version

Recorded absences block availability; voiding is an explicit audited action.

#### workforce_scheduling_policies
- id, organization_id, tenant_id, chat_id
- name, rules_json, status, effective_from, effective_until
- idempotency_key, request_hash, created_by, updated_by
- created_at, updated_at, version

Policy rules are versioned. Shift records retain the evaluated policy version, findings, state, and any authorized override provenance; the policy does not replace the canonical Service Booking or Logistics commitment authorities.


A read-only summary projection is available at GET /tenants/:chatId/workforce/utilization/summary. It aggregates the existing utilization events by member and Service Resource without creating or changing records. It reports event counts, planned minutes, measured completed planned minutes, actual minutes, variance, and completed events missing valid actual timestamps. Optional from/to filters are ISO-8601 timestamps and filter by planned_starts_at using an inclusive from and exclusive to boundary. Existing utilization view permission, tenant scope, provider member identity, and assigned resource scope apply.


## Canonical references and foreign keys

- organization_id references organizations.
- tenant_id and chat_id reference the existing tenants table.
- user_id, approver_user_id, created_by, updated_by, and committed_by reference users where applicable.
- primary_location_id and location_id reference locations.
- resource_id references service_resources.
- booking_id references service_bookings.
- member_id references workforce_members with organization/tenant-scoped composite foreign keys.
- calendar_id references workforce_calendars with organization/tenant-scoped composite foreign keys.
- operational_task_id and recurrence/source identifiers are references only; they do not create or own Logistics or scheduling records.

## Service Booking reference

Migration 87 adds one nullable workforce_member_id reference to the existing service_bookings table, plus an organization/chat/member/status index.

This is an additive link only. Service Booking remains the booking authority; Service Resource Commitment remains the resource commitment authority.

## Migrations and indexes

- Migration 86: creates the ten initial Workforce core tables and their organization/tenant/member/resource/location/booking/operational-task indexes.
- Migration 87: adds the Service Booking member reference and lookup index.
- Migrations 88–89: support external professionals and employee numbers.
- Migrations 90–96: add departments, positions, reporting references, shift templates, template-reference guards, and generated-shift provenance.
- Migration 97: adds leave and absence records.
- Migration 98: adds scheduling policies.
- Migrations 99–100: add shift scheduling-assessment evidence and authorized override provenance.
- All migrations are additive, version-guarded, and transactional.
- No canonical table is dropped or rebuilt.

## Persistence behavior

- Prepared statements and parameter binding are used for user-controlled values.
- Create operations are idempotent per organization and tenant; reusing a key with a different payload returns a conflict.
- Updates and lifecycle transitions require expected_version and increment version atomically.
- Mutations write audit provenance through the existing audit event store.
- Cross-tenant and cross-organization reads/writes are denied by scoped queries and reference checks.
