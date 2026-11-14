# SC-03 — Service Resource and Appointment Feasibility: Source Audit and Implementation Boundary

**Date:** 14 November 2026  
**Status:** Repository-grounded scope decision; implementation not yet certified  
**Baseline:** `main` at `6d7b12ff8a36ea086aca9e997f386a542b96c8f8`

## 1. Decision

Sellify has durable service-booking requests and lifecycle management, but the inspected source does not establish a canonical service-resource registry, resource-specific availability source, appointment-capacity ledger, or resource-conflict prevention mechanism.

SC-03 must therefore **not** be implemented by treating an existing booking record, Logistics capacity profile, Supplier Network capacity signal, or Logistics Scheduling feasibility result as proof that a service provider/resource is available.

The next safe implementation is a bounded, service-domain-owned resource and feasibility capability, after its ownership and reference rules are defined. Build the customer and operator UI together with the backend workflow. Do not deliver a backend-only resource API.

## 2. Verified existing foundations

### 2.1 Service booking

Inspected:
- `app/src/verticals/services/service-booking-contract.js`
- `app/src/logistics/service-bookings.js`
- `backend/server.js` — `handleServiceBookings`
- `backend/lib/store-sqlite.js` — `createServiceBooking`, `transitionServiceBooking`, `listServiceBookings`
- `phase0/service-booking-contract-regression.mjs`
- `phase0/service-booking-persistence-regression.mjs`
- `phase0/service-booking-operator-browser-regression.mjs`
- `app/src/marketplace/checkout.js` — marketplace checkout UI
- `app/src/orders/checkout.js` — merchant order checkout UI
- `backend/server.js` — `handleServiceBookings` authorization route
- `docs/SELLIFY_SERVICE_COMMERCE_CONTINUATION_HANDOFF_2026-10-20.md`

Current booking is associated with a canonical seller order and service line. It stores requested start/end and appointment mode. Durable commands use idempotency keys, request fingerprints, transactional writes, version checks and audit events. The lifecycle includes REQUESTED, ACCEPTED, CONFIRMED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED and FAILED.

The operator workspace exists in `app/src/logistics/service-bookings.js` and exposes lifecycle actions. It is an operator booking projection; it is not a resource calendar or availability-management UI. Its `canOperate()` presentation gate recognizes tenant owner/manager and the contextual roles `logistics_manager` / `logistics_dispatcher`. The backend route `handleServiceBookings` separately enforces the `scheduling` resource with `logistics:scheduling:view/request/confirm/cancel/manage` permissions. This is an existing authorization boundary, not proof that a service-specific operator role family has been designed. SC-03 must map service operator roles through the canonical Identity/Authorization model rather than silently add a parallel role system or grant Logistics permissions by default.

### 2.2 Persistence boundary

Migration 73 creates `service_bookings` with:
- organization and tenant references;
- canonical seller order and service item references;
- requested start/end and appointment mode;
- customer note, status and version;
- created/updated actor and timestamps.

Migrations 74 and 75 add server-authored execution evidence and status reason. The inspected table does not contain a service resource reference or a resource allocation/commitment record. The service booking contract explicitly rejects caller-supplied provider identity fields.

### 2.3 Logistics Scheduling

Inspected:
- `app/src/verticals/logistics/scheduling-contract.js`
- `app/src/verticals/logistics/scheduling-feasibility-contract.js`

L11.6 evaluates time overlap only against already-known scheduling activities that share canonical Order, Fulfillment or Movement references. It intentionally does not infer that unrelated activities at the same location consume the same resource. Without an authoritative external capacity decision, its outcome is UNKNOWN.

It is not a generic appointment calendar and must not become one.

### 2.4 Logistics capacity profiles

Inspected:
- `app/src/verticals/logistics/logistics-capacity-profile-contract.js`
- `phase0/logistics-capacity-profile-regression.mjs`

These are logistics-specific declarative profiles for regional freight, B2B distribution, B2C delivery and P2P delivery. The contract explicitly excludes scheduling, reservation, assignment and execution. It is not the source of truth for service staff, consultation rooms or appointment equipment.

### 2.5 Supplier Network capacity

Supplier Network capacity is supplier-declared supply evidence. It is not a service provider's appointment calendar, nor an appointment commitment. Do not reuse it as service resource availability.

## 3. SC-03 gap classification

| Capability | Finding | Status |
|---|---|---|
| Service booking request and lifecycle | Durable order-linked booking records and operator lifecycle UI exist | Implemented; relevant tests exist |
| Appointment interval normalization | Timezone-aware start/end validation exists | Implemented |
| Service resource identity/reference | No canonical service-resource reference in booking schema/contract | Missing in inspected scope |
| Resource-to-service eligibility | No inspected canonical mapping between service resources and service catalog items | Missing in inspected scope |
| Resource-specific availability | No service resource availability source found in inspected files | Missing in inspected scope |
| Appointment feasibility | No service-resource overlap/capacity evaluator found | Missing in inspected scope |
| Conflict-safe resource commitment | Booking transaction does not claim a resource or enforce resource-level exclusivity | Missing in inspected scope |
| Customer booking UI | `app/src/marketplace/checkout.js` provides a marketplace checkout modal and service delivery intake/pickup/destination fields for supported parcel-delivery service profiles; it does not expose appointment start/end, resource availability, or a service-booking create action. `app/src/orders/checkout.js` submits canonical order intent but does not create a service appointment. | Existing checkout UI only; appointment-request UI not demonstrated |
| Operator role mapping | Service-booking UI gate uses owner/manager plus Logistics contextual roles; backend route uses existing `scheduling` resource permissions. | Existing permission enforcement; service-role mapping decision required |
| Operator resource/availability UI | Existing operator booking list and lifecycle actions exist; resource setup/availability UI not found | Partial |
| Evidence, audit and concurrency | Booking command idempotency, optimistic version checks and audit exist; resource allocation evidence does not | Partial |

“Missing in inspected scope” is not a claim that no related data exists anywhere in the repository. It records the result of this bounded source inspection and must be expanded before adding schema or migrations.

## 4. Required architecture boundary

Follow the Blueprint v1.1 request-to-commitment sequence:

**Request → Assessment → Availability → Feasibility → Authorization → Commitment**

Keep the states distinct:
- Availability is a query/observation result with source and freshness.
- Feasibility evaluates resource eligibility, interval, duration, service constraints and conflicts.
- Authorization permits an operator/customer action according to server-side policy.
- Commitment records the accepted business obligation.
- Confirmation communicates the committed state; it must not create a commitment by itself.

For the initial service appointment slice:
1. Service Booking remains the canonical appointment request and lifecycle authority.
2. A service-domain-owned resource capability may own the service resources and their service eligibility/availability only after existing organization, identity and location references are mapped.
3. Existing Identity, Organization, Membership, Location and Audit authorities remain authoritative for their data.
4. Do not create a second user, organization, location, inventory, asset or logistics authority.
5. Do not turn Logistics Scheduling into a universal calendar.
6. Do not use Supplier Network capacity as appointment availability.
7. Do not let a feasibility result authorize or commit a booking.
8. Resource commitment must be atomic and concurrency-safe within the service appointment owner; same-resource overlapping active commitments must not both succeed.
9. Unknown, stale, missing or conflicting availability evidence must not be represented as available.
10. Cancellation must release only the corresponding service-resource commitment; it must not alter canonical Order, Payment, Inventory or Fulfillment state.

## 5. UI-first-and-together acceptance requirement

SC-03 is not complete with backend contracts or endpoints alone. The same implementation work package must include:

### Customer-facing booking journey
- Add a customer appointment-request surface to the existing customer/service journey; do not confuse marketplace order checkout or parcel delivery intake with an appointment request.
- Show the service and the canonical order context.
- Collect appointment date/time and mode.
- Display availability results with source/freshness semantics.
- Distinguish unavailable, conditional, unknown and feasible states.
- Prevent a false “confirmed” message before a successful canonical commitment.
- Show pending/unknown outcome and safe retry/reconciliation behavior.

### Operator service workspace
- Manage service resources using existing organization/location/identity references.
- Configure service eligibility and operating availability through the service-domain owner.
- View appointment requests and resource feasibility evidence.
- Display resource conflicts and stale/unknown evidence.
- Allow only authorized commitment/lifecycle actions.
- Show commitment identity, version, audit/evidence and cancellation/release state.

Both surfaces must share the same API contracts, validation, states, permissions, localization, audit semantics and design system. UI visibility is not authorization; the server remains the enforcement boundary.

## 6. Required tests before implementation exit

- Cross-tenant and cross-organization resource isolation.
- Service/resource eligibility and inactive resource rejection.
- Timezone normalization, invalid intervals, boundary-touching intervals and overlapping intervals.
- Resource-specific operating windows, blackout periods and stale/missing availability evidence.
- Two concurrent requests for the same resource and overlapping interval: at most one commitment succeeds.
- Idempotent create/commit replay and same-key/different-payload conflict.
- Optimistic version conflict and safe retry.
- Cancellation releases the correct commitment exactly once.
- UNKNOWN is not rendered as AVAILABLE or CONFIRMED.
- Authorization denial at API boundary even when UI controls are hidden or forged.
- Customer and operator browser journeys, including stale responses, session/tenant changes, loading, empty, error and unknown outcomes.
- No unintended Order, Payment, Inventory, Fulfillment or Logistics mutation.

## 7. Additional source findings: customer journey and role mapping

The current marketplace checkout module (`app/src/marketplace/checkout.js`) groups cart entries by seller and handles Telegram WebApp, direct API, and local queue submission. For selected parcel-delivery service profiles it conditionally exposes service pickup and destination inputs. These fields describe delivery intake, not an appointment interval or provider/resource selection.

The merchant order checkout module (`app/src/orders/checkout.js`) composes the merchant's order and payment workflow. The inspected module does not create a customer service appointment. The operator module (`app/src/logistics/service-bookings.js`) loads and renders bookings for canonical service orders and provides lifecycle actions; it has no resource administration, calendar, or customer booking form.

The route in `backend/server.js` enforces existing `scheduling` permissions for booking reads and commands. The UI role gate is only a visibility hint. SC-03 must confirm how service-specific roles, locations, and resource ownership are represented in the existing Identity/Authorization authorities before changing the permission vocabulary. Do not assume that every service operator should receive Logistics permissions.

This means the initial SC-03 UI scope is not merely an enhancement to the operator workspace: it must also add the customer appointment request journey and operator resource/availability workspace, both backed by the same service-owned availability/feasibility/commitment contracts.

## 8. Implementation gate

Before creating schema or endpoints, complete a second focused repository pass for:
- all organization-owned resource/person/asset/facility models and APIs;
- service catalog metadata and service eligibility;
- booking route permissions and existing migration conventions;
- event/audit contracts and idempotency patterns;
- customer order detail/checkout UI entry points;
- current customer-facing service journey and browser tests.

Then select the smallest domain-owned resource model that closes the demonstrated gap. Prefer reuse of canonical references over duplicating identity/location/asset data. If no existing owner is suitable, explicitly document the new service-domain ownership and migration/rollback plan before coding.

**Exit condition:** A customer can request a service appointment, the service operator can assess the real resource, and the system can create a concurrency-safe authorized commitment with evidence—while all UI and backend states remain truthful and canonical authorities stay intact.

## 9. Governing source

This audit follows `Sellify_Capability_Leverage_Implementation_Blueprint_v1.1`, especially:
- Section 6.2 — Request-to-commitment.
- Section 7 — shared primitives without a universal business database.
- Section 8, Wave 2 — request, availability, feasibility, authorization and commitment.
- Section 9 — existing service booking and Logistics Scheduling verification boundaries.
- Section 10 — evidence-based implementation status.
- Section 30 — required decision gates.

This document is a bounded source audit and implementation gate, not a claim that SC-03 is implemented or certified.
