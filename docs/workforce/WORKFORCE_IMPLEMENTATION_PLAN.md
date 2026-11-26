# Workforce Implementation Plan

## Status

Persistence, repository, central authorization, API registration, Service Booking linkage, authenticated operator workspace, and regression coverage originated on `feature/workforce-capability-20261124` and have been selectively extracted onto `integration/workforce-capability-20261126`, based on `main` at `b377b662c460cc2df59abaf3de6db8e1b393769a`.

The integration branch excludes unrelated B2B, onboarding, preview-workflow, and preview-profile changes. At integration head `165047832e5c30df601d45904bd83c77687d5bd6`, the Workforce Node 24 workflow, full Sellify CI, Repository Security Checks, Perplexity audit inventory, and listed Supplier Network regression workflows completed successfully. The full CI run included baseline, Phase 13.10.24, Phase 21, Logistics L18, and Logistics exit certification. This verifies the tested commit; it does not merge or deploy the capability.

The branch remains a draft PR for review. Final integration certification remains pending production-like migration backup/restore rehearsal, foreign-key validation, and manual browser/mobile usability review. These operational checks are not replaced by passing CI.

## Phase 1: Design and contracts — complete

- Capability map.
- Authorization map.
- Data model.
- Integration boundaries.
- Entity-specific repository contract version 1.1.
- Entity lifecycle operations are not forced into one generic state machine.

## Phase 2: Persistence foundation — implemented and verified

- Migration 86: runWorkforceSqliteMigrations.
- Migration 87: runWorkforceServiceBookingMigration.
- Ten initial core Workforce tables.
- Follow-on additive migrations 88–100 add external-member identity support, employee numbers, departments, positions, reporting structure, shift templates, leave/absence, scheduling policies, persisted assessment evidence, and authorized override metadata.
- Organization, tenant, member, user, location, resource, and booking references.
- Version, idempotency, audit provenance, and scoped indexes.
- Additive migrations only; no canonical table is dropped or rebuilt.

## Phase 3: Member lifecycle — implemented and verified

- Create, get, list, and update.
- Activate, suspend, and deactivate.
- Existing User and active tenant membership are reused.
- User identity link is immutable after creation.
- Idempotency and optimistic concurrency.

## Phase 4: Profile and engagement — implemented and verified

- Profile create/get/list/update.
- Skills, qualifications, languages, service capabilities, visibility, notes, and effective dating.
- Engagement create/get/list/update.
- Submit, activate, suspend, and end lifecycle.
- Member references are immutable after creation.

## Phase 5: Calendar and availability — implemented and verified

- Calendar create/get/list/update.
- Calendar exception create/get/list/update/cancel.
- Availability window create/get/list/update.
- IANA timezone validation and explicit timezone requirements for appointment windows.
- Availability values remain AVAILABLE, UNAVAILABLE, TENTATIVE, or BLACKOUT.
- Bounded DAILY/WEEKLY recurrence rules are evaluated against concrete booking windows in the declared IANA timezone; unsupported rules fail closed.

## Phase 6: Assignment and shifts — implemented and verified

- Assignment create/get/list/update.
- Activate, suspend, and end assignment lifecycle.
- Resource/location scope and optional references to existing bookings or operational tasks.
- Shift create/get/list/update.
- Confirm, start, complete, and cancel shift lifecycle.
- Member and parent authority references are immutable after creation.

## Phase 7: Service Booking integration — implemented and verified

- Migration 87 adds workforce_member_id to the existing service_bookings table.
- Member linkage is accepted only during authorized Service Booking confirmation.
- Member must be ACTIVE and retain an active canonical tenant membership.
- An ACTIVE assignment and AVAILABLE window must cover the full booking interval and match the selected resource/location.
- Recurring Workforce availability is evaluated using the bounded DAILY/WEEKLY recurrence contract in the declared IANA timezone.
- Existing Service Booking lifecycle and authorization remain in force.
- Existing Service Resource Commitment creates the canonical resource commitment.
- Provider appointment reads are filtered by Workforce member identity.
- Workforce does not create bookings, resource commitments, or Logistics tasks.

## Phase 8: Allocation and utilization — API and lifecycle implemented

- Allocation create/get/list/update.
- Submit, approve, release, and cancel.
- Approval re-reads the pending allocation and re-assesses member, engagement, calendar, leave/absence, shifts, availability, scheduling policy, Service Booking and Logistics evidence inside the SQLite write transaction; UNKNOWN or conflict cannot commit.
- Generic updates are restricted to DRAFT allocations; committed/pending allocations cannot bypass lifecycle protection.
- Utilization create/get/list/update.
- Start, complete, and cancel.
- Planned and actual timestamps are distinct.
- Read-only utilization analytics and planned-versus-actual reporting are implemented and verified, grouped by member and resource.
- Service Booking does not create a duplicate Workforce allocation record.

## Implementation files

### Persistence and repository

- backend/lib/workforce-sqlite-migrations.js
- backend/lib/workforce-sqlite-repository.js
- backend/lib/workforce-repository-contract.js
- backend/lib/store-sqlite.js

### Authorization

- backend/lib/workforce-authorization-adapter.js
- backend/lib/workforce-authorization-service.js
- backend/lib/authorization.js
- backend/lib/tenant-isolation.js

### API and Service Booking

- backend/lib/workforce-api-validation.js
- backend/lib/workforce-booking-integration.js
- backend/lib/workforce-recurrence-contract.js
- backend/server.js

### Operator workspace

- app/src/workforce/ui.js — authenticated roster, utilization summary, member record views, member activation/suspension actions, and availability declaration. All writes use the existing tenant session and Workforce API.
- app/src/ui/tabs.js — More-sheet navigation integration.
- app/index.html — mobile-responsive Workforce screen and navigation entry.

## API route surface

All routes require the existing tenant session.

Base path: /tenants/:chatId/workforce/:entity

- GET /tenants/:chatId/workforce/:entity
- POST /tenants/:chatId/workforce/:entity
- GET /tenants/:chatId/workforce/:entity/:id
- GET /tenants/:chatId/workforce/utilization/summary — read-only planned-versus-actual projection using existing utilization events.
- PATCH /tenants/:chatId/workforce/:entity/:id
- POST /tenants/:chatId/workforce/:entity/:id/:action

Entity slugs:

- members
- profiles
- engagements
- calendars
- calendar-exceptions
- availability
- assignments
- shifts
- allocations
- utilization

The lifecycle action route accepts activate, suspend, deactivate, release, cancel, submit, approve, confirm, start, complete, and end. Each entity contract and repository transition map restricts which actions actually apply.

## Registered permissions

All permissions are registered in backend/lib/authorization.js:

- workforce:member:view
- workforce:member:manage
- workforce:member:activate
- workforce:member:suspend
- workforce:profile:view
- workforce:profile:manage
- workforce:engagement:view
- workforce:engagement:manage
- workforce:calendar:view
- workforce:calendar:manage
- workforce:availability:view
- workforce:availability:manage
- workforce:assignment:view
- workforce:assignment:manage
- workforce:allocation:view
- workforce:allocation:manage
- workforce:allocation:release
- workforce:utilization:view
- workforce:utilization:manage

Shift access maps to assignment permissions; calendar exceptions map to calendar permissions. Service Provider access is read-only, resource-scoped, and member-scoped.

## Regression inventory

Existing Workforce regressions run by the Node 24 workflow:

- phase0/workforce-contract-regression.mjs
- phase0/workforce-member-contract-regression.mjs
- phase0/workforce-profile-engagement-regression.mjs
- phase0/workforce-calendar-availability-regression.mjs
- phase0/workforce-assignment-shift-regression.mjs
- phase0/workforce-allocation-utilization-regression.mjs
- phase0/workforce-booking-integration-regression.mjs
- phase0/workforce-authorization-service-regression.mjs

New regressions:

- phase0/workforce-repository-contract-regression.mjs
- phase0/workforce-sqlite-migration-regression.mjs
- phase0/workforce-sqlite-repository-regression.mjs
- phase0/workforce-authorization-adapter-regression.mjs
- phase0/workforce-api-regression.mjs
- phase0/workforce-api-http-regression.mjs — authenticated HTTP coverage for session enforcement, all ten entity collection create/read/list routes, entity-specific lifecycle transitions, idempotency replay, optimistic concurrency, and cross-tenant isolation.
- phase0/workforce-service-booking-integration-regression.mjs
- phase0/workforce-route-inventory-regression.mjs
- phase0/workforce-operator-workspace-regression.mjs — navigation, authenticated API client, tenant/session race protection, and UI/backend authority boundary.

The route inventory script is scripts/perplexity-server-route-inventory.mjs. The workflow runs it and validates the generated JSON inventory.

## Verification commands

- node phase0/workforce-repository-contract-regression.mjs
- node phase0/workforce-sqlite-migration-regression.mjs
- node phase0/workforce-sqlite-repository-regression.mjs
- node phase0/workforce-authorization-adapter-regression.mjs
- node phase0/workforce-api-regression.mjs
- node phase0/workforce-api-http-regression.mjs
- node phase0/workforce-service-booking-integration-regression.mjs
- node scripts/perplexity-server-route-inventory.mjs
- node phase0/workforce-route-inventory-regression.mjs

The existing eight contract regressions are also run directly by the Node 24 Workforce capability workflow.

## Completed follow-on increments

- Authenticated HTTP-level API regression — verified on Node 24. It covers all ten entity collection create/read/list routes, entity-specific lifecycle transitions, idempotency replay, optimistic concurrency, and cross-tenant read/write denial.
- Bounded availability recurrence evaluation — verified on Node 24 through both contract and production SQLite Service Booking integration tests. DAILY/WEEKLY rules, interval, BYDAY, COUNT, UNTIL, effective dates, local wall-clock time, and daylight-saving transitions are covered; unsupported rules fail closed.
- Utilization analytics — implemented and verified in the SQLite repository and authenticated HTTP API. Read-only summaries include planned, measured-planned, actual, variance, completed/open/cancelled/missing-actual counts, member/resource grouping, scoped filters, range validation, and tenant/provider isolation.
- Booking/allocation boundary decision — resolved. Service Booking confirmation does not create a Workforce allocation. A Workforce allocation is created only for separately planned workforce work; Service Resource Commitment remains the canonical booking/resource commitment authority.

## Remaining work

1. Rehearse additive migrations on a production-like database with backup/restore and foreign-key validation.
2. Perform a manual browser/mobile usability review of the operator workspace against a test tenant. CI verifies the integration contract but does not replace visual and interaction testing on a real browser/device.

## Known limitations

- Legacy provider appointments without workforce_member_id are hidden from provider queues until member ownership is established.
- Recurrence supports a bounded DAILY/WEEKLY subset; unsupported rules and overnight recurring windows fail closed.
- Service Booking confirmation creates the canonical Service Resource Commitment; it does not create a second Workforce allocation.
- Operator workspace browser behavior has not yet been visually smoke-tested on a real mobile device; API and source-level integration are covered by CI.
- No payroll, HRIS, supplier-capacity, inventory, payment, fulfillment, catalog, or logistics-task authority is introduced.
