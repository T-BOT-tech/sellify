# SC-03 — Service Resource and Appointment Feasibility: Current-Main Source Audit

**Audit date:** 2026-11-19  
**Source-code baseline:** `main` at `ef130935056ed9611fa316f9df3b470f20b08934` (the subsequent mainline commits through `4dc3873899d271b91c91f15cddc63ad63f09805f` changed documentation only).  
**Status:** Core SC-03 resource/appointment slice implemented with automated regression evidence. Updated 21 November 2026 for the Service Booking/Logistics authorization boundary correction. Manual full-stack visual evaluation and broader product-policy follow-ups remain open.

## 1. Decision

The 14 November SC-03 audit is obsolete. Its central finding—that Sellify lacked a canonical service-resource registry, resource-specific availability, resource commitments, conflict prevention, and a customer appointment journey—is no longer true on current mainline.

The current implementation has:
- a service-owned resource registry and service eligibility binding;
- declared working hours, date exceptions, and timezone-aware schedule validation;
- buyer-facing advisory feasibility based on declared hours and canonical commitments;
- durable appointment requests linked to canonical seller orders;
- atomic resource commitment during authorized confirmation;
- conflict prevention, idempotency, optimistic versions, audit, and terminal release;
- resource-scoped Service Provider access and queue projection;
- a customer appointment request/history UI;
- a dedicated operator Appointments workspace independent of the Logistics delivery workspace.

This is an implemented service-domain capability, not a universal reservation authority. Preserve Commerce Order, Identity, Organization, Location, Payment, Inventory, Fulfillment, Logistics, Events, and Audit as their existing owners.

## 2. Current end-to-end model

The implemented flow is:

1. **Catalog and Order:** A service item remains a canonical Commerce/Catalog service line on a canonical seller order. A service item is not physical stock.
2. **Buyer ownership:** Telegram storefront appointment history and requests resolve the buyer's marketplace order and seller order. Foreign buyers/sellers and invalid Telegram initData fail closed.
3. **Advisory feasibility:** The buyer asks whether a requested service interval fits a matching active resource's declared schedule and current committed intervals. The result is FEASIBLE, CONFLICT, or UNKNOWN with a reason code and timezone. It explicitly does not confirm availability or reserve a resource.
4. **Request:** The customer submits an idempotent service-booking request. It is stored as REQUESTED with no resource assignment and no commitment.
5. **Operator lifecycle:** An authorized operator reviews the booking and advances it through the existing Service Booking lifecycle.
6. **Commitment:** During CONFIRMED transition, one SQLite write transaction rechecks tenant/organization, booking version, active resource, service-item binding, ON_SITE order/resource location compatibility, resource timezone, declared working hours/exceptions, and overlapping committed intervals. It updates the booking and inserts the matching resource commitment atomically.
7. **Provider projection:** A resource-scoped Service Provider can read only active resources and bookings for the exact assigned resource scope. The queue joins the canonical booking, resource, and matching active commitment.
8. **Release:** CANCELLED, FAILED, and COMPLETED transitions release the corresponding active commitment in the same booking transaction. A completed/released slot can be reused.

**FEASIBLE ≠ AUTHORIZATION ≠ EXECUTION. REQUESTED ≠ CONFIRMED.** A feasibility result is advisory; a request does not reserve time; confirmation is the authorized commitment boundary.

## 3. Database and migration evidence

Current service schema sequence:
- **Migration 78:** `service_resources` and `service_resource_commands`.
- **Migration 79:** `service_resource_availability` and idempotent availability command responses.
- **Migration 80:** optional `service_bookings.service_resource_id` and `service_resource_commitments`.
- **Migration 81:** compatibility bridge for alternative prior resource-binding/commitment shapes and safe migration of only explicitly bound active bookings. It does not invent resources for legacy confirmed appointments.
- **Migration 82:** optional location-local timezone; NULL inherits organization timezone.
- **Migration 83:** Restaurant Recipe foundation, unrelated to SC-03.

Important database invariants:
- Resource records are scoped by organization and tenant.
- A resource may bind to a service catalog item and canonical location.
- Resource and availability commands are idempotent and versioned.
- A booking has at most one commitment row.
- Commitment intervals require end > start and use COMMITTED/RELEASED states.
- Confirmation runs under `BEGIN IMMEDIATE`, checks overlap, and inserts the commitment in the same transaction.
- Schedule edits cannot invalidate existing committed appointments.
- A resource with active commitments cannot be deactivated or reassigned.
- Legacy confirmed bookings without a proven matching commitment remain UNKNOWN for overlapping feasibility; migration does not fabricate a resource assignment.

## 4. API and authorization evidence

### Operator/resource APIs

The current backend registers:
- `GET/POST /tenants/:chatId/service-resources`
- `PATCH /tenants/:chatId/service-resources/:resourceId`
- `GET/PUT /tenants/:chatId/service-resources/:resourceId/availability`
- `GET /tenants/:chatId/service-provider/resources`
- `GET /tenants/:chatId/service-provider/bookings`
- `GET/POST /tenants/:chatId/orders/:serverOrderId/service-bookings`
- `PATCH /tenants/:chatId/orders/:serverOrderId/service-bookings/:bookingId`

The server enforces existing resource/action authorization and location/resource scope. Owner/Manager UI gates are only presentation. Resource-scoped `service_provider` contextual assignments are checked server-side for the exact active resource. Assignment revocation removes the scope from an already-issued session's effective authorization.

Booking lifecycle routes use Service-specific permissions (`service:service_booking:view/request/manage/confirm/cancel`) and remain within the canonical Service Booking authority. Logistics Manager/Dispatcher retain their Logistics Scheduling permissions and may read Service Resources where separately authorized, but they do not inherit Service Booking lifecycle access. Service Provider remains resource-scoped and view-only; it cannot confirm, cancel, or manage bookings. Do not infer that visibility of Appointments or a resource queue grants lifecycle transition rights. Any future change to provider lifecycle authority requires an explicit Identity/Authorization decision with HTTP denial and allow-path tests.

### Telegram buyer APIs

The existing Telegram storefront exposes buyer-owned order appointment history, request/cancel, and advisory feasibility routes under:
- `/api/telegram-storefront/:chatId/orders/:marketplaceOrderId/service-bookings`
- `/api/telegram-storefront/:chatId/orders/:marketplaceOrderId/service-feasibility`
- the corresponding booking cancellation route.

The backend verifies Telegram buyer identity and the buyer-to-marketplace-order-to-seller-order binding. Unknown, foreign-buyer, and foreign-seller orders do not leak order/appointment existence.

## 5. Frontend and operator UI evidence

### Customer

- `app/store.js` exposes Appointments from the buyer's order history.
- `app/store.html` provides responsive appointment cards, request form, feasibility state, and keyboard focus styling.
- The customer can choose service, requested interval, appointment mode, and note.
- The time check is read-only. FEASIBLE is presented as “likely feasible” based on declared hours and current commitments; it is not a reservation.
- UNKNOWN can still be sent as a request for provider review; CONFLICT blocks the request until the customer selects another interval.
- Offline appointment requests/cancellations are not queued or represented as successful.

### Operator

- `app/src/logistics/service-bookings.js` owns the existing service booking/resource workspace projection.
- `app/src/logistics/ui.js` and `app/src/ui/tabs.js` expose a dedicated Appointments destination.
- The workspace reuses the canonical service-bookings module; it does not create a second booking API, lifecycle, or table.
- Operator transition and resource rename actions use inline forms and accessible status feedback rather than blocking prompt/alert dialogs.
- Appointments is no longer embedded in the Logistics delivery workspace.

The customer cancellation interaction still uses a browser confirmation dialog in `app/store.js`; manual UI review should decide whether an inline confirmation is preferable. This is a UX follow-up, not evidence that the booking authority is missing.

## 6. Automated regression evidence

| Concern | Regression |
|---|---|
| Resource schema, Catalog binding, scope, idempotency, version, audit | `phase0/service-resource-foundation-regression.mjs`, `phase0/service-resource-persistence-regression.mjs` |
| Working-hours, timezone, exceptions, invalid windows | `phase0/service-availability-contract-regression.mjs`, `phase0/service-availability-api-regression.mjs` |
| Migration 80/81 compatibility | `phase0/sc-03.4-resource-commitment-migration-regression.mjs` |
| Booking lifecycle, resource assignment, location matching, schedule checks, overlap and release | `phase0/service-booking-persistence-regression.mjs` |
| Concurrent same-resource confirmations | `service-booking-persistence-regression.mjs` runs two confirmations concurrently and asserts exactly one succeeds while the loser receives `SERVICE_BOOKING_RESOURCE_CONFLICT`. |
| Buyer ownership, advisory feasibility, legacy UNKNOWN, provider queue isolation, commitment release | `phase0/sc-03.5-buyer-appointment-order-regression.mjs` |
| Real backend HTTP, Telegram auth, buyer order ownership, request/cancel, capability gating, resource-scoped provider access and assignment revocation | `phase0/sc-03.5-telegram-appointments-http-regression.mjs` |
| Service Booking vs Logistics Scheduling authorization, provider view-only scope, manager lifecycle actions and preserved Logistics authority | `phase0/service-booking-scheduling-authority-boundary-regression.mjs`; `phase0/gap-2-logistics-authorization-foundation-regression.mjs` |
| Service Provider exact resource scope, active staff membership, same-tenant resource checks and Service Pack session gating | `phase0/service-provider-resource-scope-regression.mjs` |
| Customer form, responsive layout, keyboard navigation, feasibility states, stale check, request and cancellation UX | `phase0/sc-03.5-customer-appointments-browser-regression.mjs` |
| Operator inline forms and browser interactions | `phase0/service-booking-operator-browser-regression.mjs` |
| Standalone Appointments navigation and role visibility | `phase0/service-bookings-appointments-navigation-regression.mjs` |

The customer/operator browser tests use browser-side API fixtures for UI isolation; the real backend/SQLite HTTP and persistence regressions run separately. The automated suite therefore covers both sides, but a single browser session through the real customer UI and live backend is not yet the demonstrated CI path.

## 7. What is implemented versus what is not claimed

### Implemented in the current SC-03 slice

- Canonical resource identity and service binding.
- Declared schedules, exceptions, and timezone handling.
- Read-only buyer feasibility against current commitments.
- Request lifecycle and customer UI.
- Authorized atomic resource commitment and overlap prevention.
- Idempotency, version conflicts, tenant/location scope, and audit.
- Commitment release on terminal booking transitions.
- Resource-scoped provider queue and role revocation.
- Customer and operator browser/HTTP/SQLite regression coverage.

### Explicit limitations / next product decisions

1. **Declared evidence, not live presence.** Feasibility uses declared working hours and persisted commitments. It does not prove that a provider is online, physically present, or independently verified as available.
2. **No hold during feasibility.** FEASIBLE does not reserve the interval. Another operator can commit before confirmation; confirmation rechecks and may return a conflict.
3. **No universal slot engine.** The customer supplies start/end. A separate service-duration catalog rule, slot granularity, buffer policy, recurrence, travel-time calculation, and multi-resource bundle are not established by this slice.
4. **Mode-specific policy.** ON_SITE confirmation enforces canonical order/resource location compatibility. More detailed CUSTOMER_LOCATION travel-area and REMOTE operating policies require explicit product/domain rules before implementation.
5. **Provider lifecycle authority.** Resource-scoped provider reads and availability maintenance are tested; do not assume that the same role may confirm, reject, or complete bookings without an explicit authorization decision.
6. **Cross-channel parity.** The buyer-facing journey is demonstrated for the Telegram storefront; parity for other channels is not certified.
7. **Manual UI evaluation.** The private Node 24 Codespaces environment is prepared and merged, but actual Codespace creation, forwarded-port runtime, Android browser review, and visual sign-off remain pending.
8. **Evidence freshness.** Service appointment feasibility currently uses service-owned declared schedule and commitments. Cross-domain Supplier Network/Logistics observed-at/valid-until evidence is a separate Phase 21.4 gap; do not fold it into the service booking authority.

## 8. Current verification status

The exact candidate heads for:
- PR #273: `cffb6895e480d16fb341c6c2d0f79e3a2b4fed12`
- PR #276: `d993c55ae4f271eb7f093f3a62e0e9b88a546670`

passed Repository Security Checks and all Sellify CI jobs: Node 24 baseline, Phase 13.10.24, Logistics L18, and Logistics exit certification. PR #278's environment-only candidate also passed those gates.

The mainline merge commits were not separately observed running post-merge workflows. The current Codespaces guide explicitly labels the environment **prepared, not runtime-verified** until the Codespace is created and the manual UI evaluation is completed.

## 9. Exit decision

SC-03's resource/appointment implementation is not a missing foundation and should not be rebuilt. Do not start another resource registry, appointment calendar, Logistics scheduling authority, or booking lifecycle.

Proceed to the next evidence-based gap only after preserving the above boundaries: freshness-aware Supplier Network/Logistics capacity evidence through existing Discovery matching, with explicit product policy for evidence quality and validity.

**This audit changes no application code, schema, migration, route, permission, or canonical authority.**
