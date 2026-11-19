# Sellify Service Capability Composition Map & Gap Register

**Audit date:** 2026-11-19  
**Repository baseline:** `main` at `ef130935056ed9611fa316f9df3b470f20b08934`  
**Status:** Current-main source audit; implementation status reconciled against code, migrations, tests, and exact-head CI evidence. This is not a production or post-merge certification.

## 1. Decision

The 14 November audit is stale. Since that snapshot, the repository has implemented the SC-03 service-resource and appointment foundation, the customer appointment journey, the standalone operator Appointments workspace, IndexedDB-backed tenant/session restoration, and asynchronous Pack Recovery rendering.

**The next material composition gap is not a missing service-resource registry or a universal booking engine. It is evidence freshness and quality across existing Supplier Network and Logistics capacity signals and the existing Discovery matching path.**

Preserve the canonical owners:
- Supplier Network owns supplier capacity declarations and their provenance.
- Logistics owns logistics provider capability and operating evidence.
- Discovery owns deterministic eligibility/matching, not source evidence.
- Procurement owns demand, RFQ, comparison, award, and purchase-order workflow.
- Service Booking owns appointment request/lifecycle; Service Resources and their commitments remain service-domain data.
- Commerce, Payment, Inventory, Fulfillment, Identity, Organizations, Locations, Events, and Audit remain their existing authorities.

Do not create a shared reservation database, duplicate capacity store, second order/payment authority, or a universal Logistics calendar.

## 2. Mainline changes since the prior audit

The current mainline includes the following merged work:
- **PR #273:** dedicated Appointments navigation/workspace and inline operator actions.
- **PR #276:** IndexedDB tenant/session restoration, durable tenant-switch persistence, and asynchronous Pack Recovery readiness rendering.
- **PR #278:** private Node 24 Codespaces UI-evaluation environment and current-main evaluation guide.

The exact candidate commits for #273, #276, and #278 each passed Repository Security Checks and the Sellify CI jobs for Node 24 baseline, Phase 13.10.24, Logistics L18, and Logistics exit certification. The current mainline merge commits have not been separately observed running a post-merge workflow in this audit; therefore this document does not claim post-merge repository certification.

## 3. Current authority and composition map

| Capability area | Current source and evidence | Owner / boundary | Status |
|---|---|---|---|
| Catalog identity | `backend/lib/store-sqlite.js`, catalog API, `app/src/warehouse/catalog-item-type.js` | Commerce/Catalog owns product and service identity | **Implemented**. A service item is not stock or appointment capacity. |
| Service Booking lifecycle | `backend/lib/store-sqlite.js` booking functions; `backend/server.js` booking routes; `app/src/logistics/service-bookings.js` | Service Booking lifecycle linked to canonical seller order; existing scheduling permissions enforce operator actions | **Implemented** with idempotency, versioning, audit, execution evidence, and lifecycle transitions. |
| Service Resources | `service_resources`, migration 78; resource CRUD in store/API; resource management UI | Service domain owns service resource identity; Organization/Location remain canonical | **Implemented** with tenant/org/location scope, service-catalog binding, optimistic version, idempotency, and audit. |
| Declared service availability | `service_resource_availability`, migration 79; `backend/lib/service-availability-contract.js`; GET/PUT availability API | Service domain owns declared working hours, exceptions, and schedule timezone | **Implemented** as declaration/configuration, not a guarantee of availability. |
| Appointment commitments | `service_resource_commitments`, migration 80 and compatibility migration 81; transactional confirmation | Service Booking/Service Resource boundary | **Implemented**. Confirmation rechecks schedule and overlap inside a write transaction; terminal transitions release commitments. |
| Location timezone | Migration 82 and location timezone resolution | Locations/Organizations remain timezone authority | **Implemented** with location timezone preferred and organization timezone fallback. |
| Customer appointments | `app/store.js`, `app/store.html`; Telegram storefront buyer routes | Buyer-owned marketplace order + existing Service Booking authority | **Implemented** for the Telegram storefront journey. Request is not confirmation or reservation. |
| Operator Appointments | `app/src/logistics/ui.js`, `app/src/ui/tabs.js`, `app/src/logistics/service-bookings.js` | Existing booking/resource authorities; standalone navigation, not a second Logistics authority | **Implemented**. Appointments no longer needs to be embedded in the Logistics delivery workspace. |
| Service Provider scope | `service_provider` contextual role with RESOURCE scope; provider resources/booking APIs | Identity/Authorization remains server enforcement | **Implemented** for exact-resource queue and availability access, including revocation behavior. Lifecycle transition rights still follow existing server scheduling permissions; UI visibility must not be treated as authorization. |
| Supplier Network capacity | `supplier_network_capacity_signals`; capacity CRUD/API; supplier discovery provider | Supplier Network owns declared supply evidence | **Implemented** for quantity, unit, period, availability, visibility, status, and source=DECLARED. |
| Discovery matching | `backend/lib/discovery/matching-contract.js`; Supplier Network and Logistics providers | Discovery owns deterministic matching only | **Implemented** for subject, quantity, unit, active status, availability state, and declared period overlap. Evidence freshness/quality is not yet consumed. |
| Phase 21 evidence projection | `app/src/phase21-capacity-availability-evidence.js`; `phase0/phase21.3-capacity-availability-regression.mjs` | Projection only; Supplier Network remains source authority | **Implemented contract, not integrated** into the Supplier Network or Logistics provider candidate paths inspected. |
| Procurement sourcing | `app/src/procurement/ui.js`; existing demand/RFQ/response/comparison/award APIs | Procurement owns acquisition workflow | **Implemented foundation**. UI shows declared capacity details and temporal filters; freshness and quality evidence are not shown or enforced. |
| Logistics provider matching | `backend/lib/discovery/logistics-provider-matching.js` and shared Discovery matching | Logistics provider data remains source evidence; Logistics owns later authorization/assignment | **Partial**. Quantity/unit/period/availability matching exists; freshness/quality is not preserved by the inspected normalizer. |

## 4. Reconciled gap register

Priority describes the next productization need, not a claim that the owning domain is absent.

| ID | Gap / capability | Current evidence | Current status | Priority |
|---|---|---|---|---|
| SC-01 | Cross-domain availability/evidence vocabulary | Service availability declarations and Phase 21 capacity evidence projection exist, but they are separate contracts and are not yet composed through a common query/result boundary. | **Partial** | P0 |
| SC-02 | Supplier capacity freshness and quality eligibility | Phase 19.7 matching already enforces subject, quantity, compatible unit, active status, availability state, and requested-period overlap. The Phase 21 projection's `observedAt`, `validUntil`, `quality`, and provenance are not carried into the inspected supplier candidate path or matching decision. | **Partial — declared temporal eligibility implemented; freshness/quality missing** | P0 |
| SC-03 | Service resource and appointment feasibility | Migrations 78–82, resource CRUD, declared schedules, buyer feasibility, customer request UI, provider scope, operator workspace, and canonical commitments exist. | **Implemented foundation**; manual full-stack UI evaluation remains pending | Completed for current slice |
| SC-04 | Conflict-safe commitment | `BEGIN IMMEDIATE` confirmation transaction checks active resource, service binding, ON_SITE location, declared schedule, and overlapping commitments before inserting the commitment. Terminal lifecycle transitions release it. The persistence regression runs concurrent confirmations and asserts exactly one wins. | **Implemented** | Completed for current slice |
| SC-05 | Procurement demand → supply evidence composition | Sourcing UI accepts quantity/unit/time filters and displays supplier-declared capacity signals. RFQ and comparison remain separate Procurement actions. Candidate evidence lacks freshness/quality state and does not travel as a complete evidence snapshot into RFQ review. | **Partial** | P1 |
| SC-06 | Logistics provider temporal capacity composition | Provider normalization and Discovery matching support capability, geography, quantity/unit, availability state, and declared periods. Evidence quality/freshness fields are dropped by the inspected Logistics provider normalizer. | **Partial** | P1 |
| SC-07 | Customer-facing service journey | Telegram buyer order → appointment history/request → feasibility check → REQUESTED booking → provider/operator lifecycle is present. | **Implemented for Telegram storefront**; other channels need separate evidence before claiming parity | P1 follow-up |
| SC-08 | Role-aware service and capacity UI | Dedicated Appointments workspace, resource/availability management, customer form, and resource-scoped provider projection exist. Supplier capacity display is present in sourcing UI. | **Implemented for SC-03; partial across Supplier Network/Logistics evidence presentation** | P1 |
| SC-09 | Cross-domain evidence and audit trace | Resource, availability, booking, commitment, and release operations have source-domain audit evidence. Read-only feasibility returns a reason/state but does not carry a stable evidence-reference/freshness bundle. | **Partial** | P2 |
| SC-10 | Pack/edition composition | Existing Pack activation and role foundations remain canonical. This audit did not re-audit every service/supplier/logistics manifest and entitlement mapping. | **Not re-certified in this pass** | P2 |

## 5. Important semantics and boundaries

1. **Capacity period is not evidence freshness.** `periodStart/periodEnd` describes the declared supply window. `observedAt/validUntil` describes when the evidence was observed and when it ceases to be reliable. Do not infer one from the other.
2. **Declared is not verified.** Existing Supplier Network capacity is explicitly source=DECLARED. A matching candidate is not a reservation, verified supply, supplier selection, procurement award, or authorization.
3. **FEASIBLE is advisory.** The service buyer feasibility response explicitly returns `confirmsAvailability: false`; it does not hold or commit a resource.
4. **UNKNOWN is not success.** Missing schedules, inactive provider assignments, legacy uncommitted appointments, stale results, and incomplete evidence must not be rendered as confirmed availability.
5. **Request ≠ commitment.** A customer appointment request is REQUESTED and has no assigned resource. The authorized operator confirmation transaction creates the resource commitment.
6. **UI role checks are not security.** API/server authorization remains authoritative.
7. **Install ≠ Activate; activation ≠ authorization.** Do not change Pack or capability entitlement semantics as part of evidence composition.
8. **No parallel authority.** Extend the existing Supplier Network, Logistics, Discovery, Procurement, Service Booking, and Service Resource boundaries only.

## 6. Recommended next implementation increment

### Phase 21.4 — Freshness-aware capacity evidence composition

This is the smallest next cross-domain gap demonstrated by current source:

1. Define how a capacity declaration records `observedAt`, explicit `validUntil`, and evidence `quality`. Do not invent a default TTL or equate the supply period end with evidence expiry.
2. Decide how legacy signals without freshness fields behave for time-sensitive searches. Preserve non-temporal discovery without presenting legacy signals as fresh availability.
3. Extend the existing Supplier Network capacity source/API and provider projection without moving source ownership.
4. Preserve the evidence fields in the existing Logistics provider normalizer when supplied by an adapter.
5. Extend the existing Discovery matching contract so expired, stale, unknown, conflicting, future-observed, or missing-freshness evidence cannot satisfy a time-sensitive hard constraint. Keep quantity/unit/subject/period checks.
6. Update the existing Procurement sourcing UI and Logistics candidate projection to show source, quality, observed time, validity, and UNKNOWN/STALE state.
7. Add SQLite/API/provider/matching/browser regressions and run Node 24 baseline plus the relevant Phase 19, Phase 20, and Logistics gates.

### Required decisions before schema changes

- Which actor can assert each quality state? A supplier may declare supply; it must not self-assert independent verification.
- Is `observedAt` server-authored from the update timestamp, separately captured, or both?
- Is `validUntil` mandatory for time-sensitive matching, and what is the legacy behavior?
- Which source-domain event/audit records evidence refresh, expiry, or quality changes?
- How are units normalized? Do not compare unlike units without an existing explicit conversion authority.

No new inventory, capacity, procurement, payment, or reservation store is needed for this increment.

## 7. Verification evidence and limitations

Relevant current-main regressions include:
- Service resource: `phase0/service-resource-foundation-regression.mjs`, `phase0/service-resource-persistence-regression.mjs`.
- Service availability: `phase0/service-availability-contract-regression.mjs`, `phase0/service-availability-api-regression.mjs`.
- Service commitment: `phase0/sc-03.4-resource-commitment-migration-regression.mjs`, `phase0/service-booking-persistence-regression.mjs`.
- Buyer/provider journey: `phase0/sc-03.5-buyer-appointment-order-regression.mjs`, `phase0/sc-03.5-telegram-appointments-http-regression.mjs`, `phase0/sc-03.5-customer-appointments-browser-regression.mjs`.
- Operator UI: `phase0/service-booking-operator-browser-regression.mjs`, `phase0/service-bookings-appointments-navigation-regression.mjs`.
- Capacity matching: `phase0/phase19.5-supplier-network-federation-regression.mjs`, `phase0/phase19.7-deterministic-matching-regression.mjs`, `phase0/phase21.3-capacity-availability-regression.mjs`, and the Logistics provider matching regression.

The exact PR candidate commits for #273 and #276 passed Repository Security Checks and all four Sellify CI jobs (Node 24 baseline, Phase 13.10.24, Logistics L18, Logistics exit certification). PR #278's exact candidate also passed those checks. The latest mainline merge commits were not separately observed running a post-merge workflow in this audit.

The Codespaces environment is merged and prepared. Actual Codespace creation, forwarded-port runtime, manual mobile visual review, and a single customer-browser-to-real-backend end-to-end session remain pending. Do not call this document a runtime certification.

**This is an audit artifact only. It changes no application code, schema, migration, API, permission, or canonical authority.**
