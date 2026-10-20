# Sellify Service Commerce — Implementation Continuation Handoff

**Prepared:** 20 October 2026  
**Purpose:** Resume the current Service Commerce implementation in a new chat with verified achievements, remaining gaps, and a concrete next task.  
**Repository:** `T-BOT-tech/sellify`  
**Default branch:** `main`  
**Last verified main HEAD:** `d3c093a4f3063b7fbdcbaf38f3dc9bf90183a658`  
**Working preference:** Less planning, more coding. Start by checking live GitHub state, then implement and verify the next narrow step.

---

## 1. New-chat kickoff instruction

> Continue Sellify Service Commerce implementation from `SELLIFY_SERVICE_COMMERCE_CONTINUATION_HANDOFF_2026-10-20.md`. First refresh `main`, recent commits, and the newest CI/security/release runs. The last recorded head is `d3c093a4f3063b7fbdcbaf38f3dc9bf90183a658`, where Sellify CI, Release Certification, Logistics Runtime Certification, and Repository Security Checks all passed. Continue with authenticated HTTP-level rejection/failure lifecycle coverage, idempotency conflict behavior, and tenant/location authorization regressions. Work from actual source and existing tests; make code changes rather than another planning-only round. Do not merge or close any PR without explicit permission.

## 2. Product and architecture decisions — preserve

Sellify Service Commerce is composed from existing Sellify capabilities; it is not a separate parallel commerce platform.

- Reuse the existing catalog, canonical order, Payment Core, authorization/tenant scope, fulfillment/logistics boundaries, audit/evidence, and persistence patterns.
- Preserve the authority flow: **UI intent → capability API/client → canonical backend authority → business operation → audit/evidence**.
- A service booking is an appointment/execution record associated with an existing canonical order and service line. It is not an order, payment, inventory reservation, courier task, or fulfillment authority.
- Booking confirmation does not mean payment is settled, inventory reserved, fulfillment started, or the order completed.
- Do not automatically create Logistics Scheduling activities for every service appointment. Reuse logistics scheduling only when the appointment genuinely requires an existing canonical logistics reference.
- Keep provider-neutral Logistics boundaries and server-side tenant, organization, location, authorization, idempotency, concurrency, and audit guarantees.
- Preserve the principle: **Build → Use → Learn → Prove → Extract → Reuse → Build next domain**. Avoid a premature universal workflow engine or universal Business OS.

## 3. What has been achieved

### 3.1 Service catalog and commerce integration

Existing merged work has established the product/service catalog boundary and initial service commerce flow, including:

- Canonical catalog item identity distinguishes `product` and `service`; legacy untyped catalog records remain compatible as physical products.
- Services are not treated as physical stock and do not generate physical inventory/low-stock consequences.
- Unsupported marketplace service checkout fails closed where a supported canonical contract is not available.
- Marketplace checkout has service intake/pickup and destination details in the supported paths.
- Service eligibility assessment, customer acceptance evidence, authorization, idempotency, and replay protections have been added in earlier work.
- Existing orders and payment authority remain canonical; service-specific work composes with them instead of creating parallel order/payment state.

Relevant historical merged PRs include #60, #67, #68, #69, #75, #76, #77, and #79. Re-fetch live PR state before relying on historical metadata. PR #79 (durable service booking) is recorded as merged.

### 3.2 Durable service booking contract and APIs

Files established by the current implementation include:

- `app/src/verticals/services/service-booking-contract.js`
- `backend/lib/store-sqlite.js`
- `backend/server.js`
- `phase0/service-booking-contract-regression.mjs`
- `phase0/service-booking-persistence-regression.mjs`
- `phase0/first-experience-service-catalog-http-regression.mjs`
- `phase0/gap-2-logistics-authorization-foundation-regression.mjs`
- `phase0/gap-2-production-readiness-regression.mjs`

Current endpoints:

- `GET /tenants/:tenant/orders/:orderId/service-bookings`
- `POST /tenants/:tenant/orders/:orderId/service-bookings`
- `PATCH /tenants/:tenant/orders/:orderId/service-bookings/:bookingId`

Store functions:

- `createServiceBooking(chatId, serverOrderId, input = {}, actor = null)`
- `transitionServiceBooking(chatId, serverOrderId, bookingId, input = {}, actor = null)`
- `listServiceBookings(chatId, serverOrderId)`

Lifecycle statuses:

`REQUESTED → ACCEPTED → CONFIRMED → IN_PROGRESS → COMPLETED`

Supported terminal/alternative statuses include `REJECTED`, `CANCELLED`, and `FAILED`, subject to the contract transition map.

Durable booking commands use idempotency keys and request fingerprints, tenant/order scope, transactional writes, version checks, and audit events. Appointment requests require a canonical order/service line and timezone-aware start/end values; optional mode/note are contract-defined.

### 3.3 Server-enforced authorization

The service booking HTTP handler uses operation-specific permissions:

- GET → `logistics:scheduling:view`
- POST → `logistics:scheduling:request`
- PATCH to `CONFIRMED` → `logistics:scheduling:confirm`
- PATCH to `CANCELLED` → `logistics:scheduling:cancel`
- Other PATCH lifecycle transitions → `logistics:scheduling:manage`

Canonical order location scope is enforced server-side. The existing authorization regression covers policy role/permission expectations. Continue checking actual route behavior, not only policy constants.

### 3.4 Execution evidence, server-authored timestamps, and completion notes

Migration 74 adds:

- `started_at`, `started_by`
- `completed_at`, `completed_by`
- `completion_note`

Transitions to `IN_PROGRESS` and `COMPLETED` generate their timestamps and actor evidence on the server. Caller-supplied timestamp/actor values are not authoritative. Completion notes are permitted only for `COMPLETED`, limited to 500 characters, included in the idempotency fingerprint, and captured in audit evidence.

### 3.5 Rejection/failure reasons and recovery boundaries

Migration 75 adds `status_reason`.

- Contract exposes `reason_required_statuses: ['REJECTED', 'FAILED']`.
- Rejection/failure requires a reason (maximum 500 characters).
- `status_reason` is persisted and returned on the durable booking record.
- Audit events retain the reason.
- Idempotent replay returns the durable result without duplicating lifecycle events.
- `FAILED` is terminal in the current lifecycle; do not rewrite failed history into an in-progress booking. Recovery should use a new booking unless a separately designed and authorized recovery contract is introduced.
- Caller input must not be allowed to forge server-authored execution evidence.

### 3.6 Regression coverage achieved

The existing regressions cover:

- Service booking contract and transition rules.
- Durable create/list/transition persistence.
- Authenticated HTTP create/list/accept/confirm flow.
- Rejection of missing idempotency keys at HTTP boundary.
- Start/completion server timestamps and actor identity; spoofed caller evidence ignored.
- Completion note validation, persistence, idempotent replay, and audit evidence.
- Rejection/failure reason required, persisted, returned, and audited.
- Failed booking terminal behavior.
- No unintended mutation to canonical order/payment/fulfillment status when a booking is confirmed/completed.
- No automatic Logistics Scheduling activity where no applicable canonical logistics linkage exists.
- Readiness checks now expect migration 75 after migration 74.

Recent commits on `main` include:

- `8228e26` — persist service booking execution evidence.
- `4c99c9c` — test durable service execution evidence.
- `17c34b8` — update readiness regression for migration 74.
- `2b4437a71be07778d7033e8707dbb97908039d73` — persist booking failure/rejection reasons.
- `5b7cb557d8c4b0e0db731085424c3535c5bd6549` — include status-reason migration in readiness checks.
- `d3c093a4f3063b7fbdcbaf38f3dc9bf90183a658` — test persisted failure recovery boundaries.

## 4. Verified CI state at this handoff

Live GitHub Actions were re-polled for HEAD `d3c093a4f3063b7fbdcbaf38f3dc9bf90183a658`. All four newest workflows were completed successfully:

| Workflow | Run | Result |
|---|---:|---|
| Sellify CI | [39469906751](https://github.com/T-BOT-tech/sellify/actions/runs/39469906751) | PASS |
| Sellify Release Certification | [39469906707](https://github.com/T-BOT-tech/sellify/actions/runs/39469906707) | PASS |
| Logistics Runtime Certification | [39469906553](https://github.com/T-BOT-tech/sellify/actions/runs/39469906553) | PASS |
| Repository Security Checks | [39469906816](https://github.com/T-BOT-tech/sellify/actions/runs/39469906816) | PASS |

These results are tied to the recorded SHA. Recheck all workflows at the start of the next chat and after each subsequent change. An earlier Sellify CI run on `2b4437a` failed; later commits corrected the issue and the latest recorded head passed. Do not treat an older failed run as the current result, and do not hide it if diagnosing history.

## 5. What remains — priority order

### P0 — Close HTTP-level lifecycle and authorization gaps

1. Extend `phase0/first-experience-service-catalog-http-regression.mjs` or a focused companion regression to exercise authenticated HTTP PATCH requests for:
   - `REJECTED` without a reason → expected validation failure and no state mutation.
   - `REJECTED` with a reason → reason appears in returned booking and durable record.
   - `FAILED` without a reason → expected validation failure and no state mutation.
   - `FAILED` with a reason → reason appears in returned booking and durable record.
   - Replaying the exact same idempotency key/fingerprint → same durable result, no duplicate audit event.
   - Reusing an idempotency key with a different fingerprint → explicit conflict/error; it must not conceal a conflicting command.
2. Test that a client-supplied `status_reason`, `started_at`, `started_by`, `completed_at`, or `completed_by` cannot forge or overwrite server-authored evidence.
3. Verify tenant mismatch, cross-order booking ID, and unauthorized/out-of-location actor cases on the actual HTTP routes. Confirm denial leaves booking version, status, reason, and audit history unchanged.
4. Verify response status/error mapping is consistent and safe; do not leak internal details.

### P0 — Inspect idempotency implementation before changing it

- Read the current command table/write path and fingerprint comparison in `backend/lib/store-sqlite.js`.
- Establish whether exact replay returns the original command result and whether same-key/different-payload conflicts are explicitly covered.
- Preserve transactionality and version checks. Add tests before modifying behavior.
- Do not create a second idempotency authority or bypass existing command persistence.

### P1 — Service booking usability and operational lifecycle

Once the backend boundary is verified:

- Inspect actual service booking frontend entry points and determine what exists before implementing UI.
- Make the smallest usable workflow for operators to list bookings, understand status/reason, and take the next allowed action.
- Ensure controls are permission-aware but the server remains authoritative.
- Add clear recovery paths for rejected, failed, cancelled, and stale-version operations.
- Do not mark an appointment completed based only on client-side UI state.

### P1 — Scheduling and service execution boundaries

- Decide by source evidence which service appointment types require Logistics Scheduling linkage and which are appointment-only.
- If linking logistics, require a valid canonical order/fulfillment/movement reference and reuse existing logistics authority. Do not auto-create unrelated activities.
- Document and test cancellation/no-show/reschedule semantics only after inspecting existing contract and operational requirements.
- Keep payment, refunds, inventory reservation, delivery, and order completion separate and canonical.

### P2 — Broader service commerce expansion

After P0 evidence and operator workflow are stable, evaluate service configuration/intake, service-specific pricing/policies, customer acceptance, and additional service types (e.g. errands, moving/cargo, passenger transport) as compositions of existing capabilities. Do not implement these as parallel domain authorities or assume every service needs the same lifecycle.

## 6. Repository/testing rules

- Use the live `main` source as authority; this handoff is a continuation map, not proof of current state.
- Fetch current file contents and SHA before every GitHub file update. Do not invent hashes or test outcomes.
- Run focused regressions first, then the relevant broader CI/release/security checks.
- Report PASS, FAIL, and IN PROGRESS separately.
- Never claim a local test was run if only GitHub Actions results were observed.
- Do not weaken regressions to get a green build.
- Do not merge/close PRs without explicit permission.
- Preserve existing migrations and readiness ordering; do not silently rewrite historical migrations.
- Keep the scope narrow: complete evidence-backed booking correctness before adding more service types.

## 7. First concrete action for the next chat

1. Re-fetch current `main` HEAD and the newest workflow runs.
2. Read the current versions of:
   - `backend/lib/store-sqlite.js`
   - `backend/server.js`
   - `app/src/verticals/services/service-booking-contract.js`
   - `phase0/first-experience-service-catalog-http-regression.mjs`
   - `phase0/service-booking-persistence-regression.mjs`
   - `phase0/gap-2-logistics-authorization-foundation-regression.mjs`
   - `phase0/gap-2-production-readiness-regression.mjs`
3. Implement the authenticated HTTP rejection/failure + conflicting-idempotency + scope/authorization regression coverage.
4. Run focused regressions and push a narrow change; then verify all CI/security/release checks on the resulting SHA.

**Do not spend the next chat rewriting this plan. Start with the live repo and the P0 regression work.**


---

# Continuation Addendum — 20 October 2026 (latest)

This addendum supersedes the earlier “first concrete action” and updates the CI/next-step status above. Preserve the earlier implementation history; use this addendum as the current continuation point.

## A. Latest repository and PR state

- `main` documentation commit: `0b90b85051792d21288d0795b5433903e08f15d0`.
- Service booking HTTP regression branch: `test/service-booking-http-failure-boundaries`.
- Latest test commit: `4a996fefcea6eaba897e5856c8d2a9f4f61d54ca`.
- Open PR #80: https://github.com/T-BOT-tech/sellify/pull/80
- PR #80 is **open and not merged**. Do not merge without the user's explicit permission.

### Current CI results

On the PR head `4a996fefcea6eaba897e5856c8d2a9f4f61d54ca`:

- Sellify CI: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471792924
- Repository Security Checks: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471792952

On main documentation commit `0b90b85051792d21288d0795b5433903e08f15d0`:

- Sellify CI: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471210008
- Release Certification: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471210237
- Logistics Runtime Certification: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471210937
- Repository Security Checks: **PASS** — https://github.com/T-BOT-tech/sellify/actions/runs/39471210771

The PR-specific Sellify CI and security checks have passed. The PR branch did not show a PR-head Release Certification or Logistics Runtime Certification run in the latest workflow list. Do not describe those two as passed on PR head; they are green on the latest main documentation commit. Refresh live status before any merge decision.

## B. Work completed in PR #80

Changed file: `phase0/first-experience-service-catalog-http-regression.mjs`  
Change: 127 insertions, regression coverage only; no production code changed.

Added authenticated HTTP-level checks for:

1. **Confirmation idempotency**
   - Exact retry returns `replayed: true` and does not increment booking version.
   - Reusing the same idempotency key for a different transition returns HTTP 409 with `SERVICE_BOOKING_IDEMPOTENCY_CONFLICT`.

2. **Rejection reason**
   - Missing canonical `reason` fails with HTTP 400 / `SERVICE_BOOKING_REASON_REQUIRED`.
   - Validation failure leaves the booking in `REQUESTED` and preserves version 1.
   - Valid rejection reason is returned as `booking.status_reason`.
   - Forged caller `status_reason` does not override the canonical `reason`.
   - Exact retry replays successfully; same key with a different reason conflicts.

3. **Failure reason and execution evidence**
   - Booking transitions through `ACCEPTED`, `CONFIRMED`, and `IN_PROGRESS`.
   - Spoofed client `started_at` and `started_by` do not become persisted execution evidence.
   - Missing failure reason is rejected without accepting a forged `status_reason`.
   - Valid failure reason is returned as `booking.status_reason`.
   - Exact failure retry replays; `FAILED → IN_PROGRESS` is rejected as an invalid transition.

CI and security checks are green for this commit. The tests are now proven by CI, not just proposed in a plan.

## C. Remaining work — revised priority

### P0. Review PR #80 before merge
1. Inspect the complete PR diff and live checks once more.
2. Confirm all new assertions correspond to the actual API contract and do not rely on accidental behavior.
3. Keep the PR open until the user authorizes merge. Do not merge autonomously.
4. If any check fails or the diff reveals a false-positive test, fix the test/code and rerun the relevant checks.

### P0. Extend authorization and isolation tests at the HTTP boundary
Add focused authenticated HTTP coverage for:
- Missing/invalid tenant scope.
- Cross-tenant booking access.
- Booking ID belonging to a different canonical order.
- Actor lacking the permission required for the specific transition.
- Actor outside the canonical order's location scope.
- Ensure every denied operation leaves booking status, version, reason, and audit history unchanged.

Inspect existing test helpers and authorization setup first; reuse them rather than duplicating server fixtures.

### P0. Audit idempotency and evidence semantics
- Verify whether the same key conflict is scoped correctly to tenant, operation, and booking.
- Verify behavior under stale `expected_version`, exact replay after a later lifecycle transition, and retry after a failed/rolled-back transaction.
- Assert audit event counts/identities where test fixtures expose them; successful replay must not create a duplicate lifecycle event.
- Test spoofed `completed_at`, `completed_by`, and any client-set completion evidence through HTTP as well as the store-level regression.
- Ensure a validation/authorization failure does not create a successful lifecycle event or partially mutate the booking.

### P1. Inspect existing frontend and make the smallest useful operator workflow
Only after the P0 API boundary is solid:
- Trace existing service booking UI entry points from actual repository files.
- Provide a list/status view, the next permitted action, and visible rejection/failure/cancellation reasons.
- Use capability clients/API; do not create a separate frontend authority or locally invent status.
- Respect server permissions and stale-version errors. A UI action must not imply payment settlement, inventory reservation, logistics assignment, or order completion.

### P1/P2. Scheduling semantics and service expansion
- Identify which service types actually require canonical logistics linkage and which are appointment-only.
- Do not auto-create Logistics Scheduling activities for ordinary service appointments.
- Define reschedule, cancellation, no-show, and recovery behavior only after checking current contracts and user requirements.
- Add more service types only as compositions of existing catalog, order, payment, inventory, scheduling, and audit authorities.

## D. Exact next-chat kickoff prompt

> Continue the Sellify Service Commerce work in repository `T-BOT-tech/sellify`. Read `docs/SELLIFY_SERVICE_COMMERCE_CONTINUATION_HANDOFF_2026-10-20.md`, especially the latest continuation addendum.
>
> First refresh the live `main` SHA, PR #80 diff/status, and all checks. PR #80 adds HTTP-level rejection/failure/idempotency regression coverage in `phase0/first-experience-service-catalog-http-regression.mjs`; its latest Sellify CI and security checks passed on `4a996fefcea6eaba897e5856c8d2a9f4f61d54ca`. The PR remains open and must not be merged without my explicit permission.
>
> Inspect the PR diff, then continue P0 with actual HTTP-level tenant/order/location/permission-denial tests and assertions that denied commands leave booking and audit state unchanged. Also verify idempotency conflict scope, stale-version behavior, replay after later transitions, and forged completion evidence. Reuse existing test fixtures, make narrow code/test changes, and run focused tests plus CI. Do not return to planning-only work; preserve canonical order, Payment Core, inventory, logistics, tenant, and audit authorities.
