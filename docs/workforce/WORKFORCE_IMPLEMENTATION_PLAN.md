# Workforce Implementation Plan

## Status

Persistence, repository, central authorization, API registration, Service Booking linkage, and the first regression suite are implemented on feature/workforce-capability-20261124.

The Node 24 Workforce verification workflow runs only for this branch. It does not merge or deploy the capability.

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
- Ten Workforce tables.
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
- Bounded DAILY/WEEKLY recurrence rules are evaluated against concrete booking windows in the declared IANA timezone.

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
- Existing Service Booking lifecycle and authorization remain in force.
- Existing Service Resource Commitment creates the canonical resource commitment.
- Provider appointment reads are filtered by Workforce member identity.
- Workforce does not create bookings, resource commitments, or Logistics tasks.

## Phase 8: Allocation and utilization — API and lifecycle implemented

- Allocation create/get/list/update.
- Submit, approve, release, and cancel.
- Utilization create/get/list/update.
- Start, complete, and cancel.
- Planned and actual timestamps are distinct.
- Utilization analytics and planned-versus-actual reporting remain future work.
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

## API route surface

All routes require the existing tenant session.

Base path: /tenants/:chatId/workforce/:entity

- GET /tenants/:chatId/workforce/:entity
- POST /tenants/:chatId/workforce/:entity
- GET /tenants/:chatId/workforce/:entity/:id
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
- phase0/workforce-api-http-regression.mjs — authenticated HTTP coverage for session enforcement, member CRUD, idempotency replay, lifecycle transitions, optimistic concurrency, and cross-tenant isolation.
- phase0/workforce-service-booking-integration-regression.mjs
- phase0/workforce-route-inventory-regression.mjs

The route inventory script is scripts/perplexity-server-route-inventory.mjs. The workflow runs it and validates the generated JSON inventory.

## Verification commands

- npm run test:workforce-repository-contract
- npm run test:workforce-sqlite-migration
- npm run test:workforce-sqlite-repository
- npm run test:workforce-authorization-adapter
- npm run test:workforce-api
- npm run test:workforce-api-http
- npm run test:workforce-service-booking
- npm run test:workforce-route-inventory

The existing eight contract regressions are also run directly by the Workforce capability workflow.

## Completed follow-on increments

- Authenticated HTTP-level API regression — verified on Node 24. It covers session enforcement, member create/list/get/update, idempotency replay, entity lifecycle, optimistic concurrency, and cross-tenant read/write denial. Broader per-entity HTTP coverage can be added as the API surface evolves.
- Bounded availability recurrence evaluation — verified on Node 24 through both contract and production SQLite Service Booking integration tests. DAILY/WEEKLY rules, interval, BYDAY, COUNT, UNTIL, effective dates, local wall-clock time, and daylight-saving transitions are covered; unsupported rules fail closed.

## Remaining work

1. Add utilization reporting and planned-versus-actual analytics.
2. Define whether and when a Workforce member allocation should be created alongside a booking without duplicating Service Resource Commitment authority.
3. Add operator-facing Workforce UI only after the API and authorization behavior is accepted.
4. Reconcile the in-memory repository files described in the initial handoff: they were not present in the inspected branch, so the SQLite repository is the current persistence implementation.

## Known limitations

- Legacy provider appointments without workforce_member_id are hidden from provider queues until member ownership is established.
- Recurrence supports a bounded DAILY/WEEKLY subset; unsupported rules and overnight recurring windows fail closed.
- Service Booking confirmation creates the canonical Service Resource Commitment; it does not create a second Workforce allocation.
- Authenticated HTTP regression currently exercises the member lifecycle end-to-end; equivalent HTTP coverage for every entity is future expansion.
- No payroll, HRIS, supplier-capacity, inventory, payment, fulfillment, catalog, or logistics-task authority is introduced.
