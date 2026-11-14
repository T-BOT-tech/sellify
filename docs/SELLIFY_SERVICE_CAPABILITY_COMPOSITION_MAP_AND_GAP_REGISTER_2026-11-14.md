# Sellify Service Capability Composition Map & Gap Register

**Audit date:** 2026-11-14  
**Repository baseline:** `main` at `6d7b12ff8a36ea086aca9e997f386a542b96c8f8`  
**Branch:** `audit/service-capability-composition-map-20261114`  
**Status:** Repository-grounded composition audit; no domain code changed by this artifact.

## 1. Purpose and decision

Map the current reusable capability surface across Catalog, Service Booking, Logistics, Commerce, and Supplier Network, then identify the smallest missing foundations needed to compose them into reliable service and resource-based journeys.

**Core finding:** Sellify already has substantial capability implementation. The gap is not a missing universal service engine. It is the incomplete composition of time-sensitive availability evidence, resource/slot feasibility, and an authorized commitment step across existing domain authorities.

The next increment should therefore define a **shared availability vocabulary and query boundary**, while keeping capacity, inventory, bookings, assignments, orders, payments, and fulfillment in their current owning domains. A shared contract is not a new central reservation authority.

## 2. Authority and composition map

| Capability area | Existing implementation / source | Canonical owner | Reuse classification | Current boundary and composition status |
|---|---|---|---|---|
| Catalog identity and offering data | `backend/lib/store-sqlite.js` catalog persistence; `app/src/warehouse/catalog-item-type.js`; `app/src/procurement/ui.js`; marketplace listing flow | Catalog / Commerce | **Reusable foundation** | Canonical `item_type` distinguishes product vs service; legacy `type` is fallback only. Service catalog entries are excluded from physical inventory and can be listed/ordered without stock. Service profile and delivery model are stored as offering metadata. A catalog service does not prove appointment capacity, a confirmed booking, or execution. |
| Service Booking | `app/src/verticals/services/service-booking-contract.js`; `app/src/logistics/service-bookings.js`; `backend/server.js`; `backend/lib/store-sqlite.js` booking functions; persistence, HTTP, and operator-browser regressions | Service Booking lifecycle over canonical Commerce Order; Payment Core remains payment owner; Logistics Scheduling only where a real logistics activity/reference applies | **Reusable lifecycle; resource availability/commitment missing** | Request windows, appointment mode, lifecycle, versioning, idempotency, server-authored execution evidence, operator actions and audit are present. Booking does not create an order, payment, inventory reservation, or courier assignment. The scheduling-boundary regression confirms ordinary appointments do not manufacture Logistics Scheduling activities. The booking contract accepts a requested interval but does not establish provider/resource availability or atomically commit a slot. |
| Logistics / delivery | `app/src/logistics/fulfillment.js`; `app/src/logistics/service-bookings.js`; `app/src/verticals/logistics/workspace-projection.js`; `app/src/verticals/logistics/scheduling-contract.js`; `app/src/verticals/logistics/scheduling-feasibility-contract.js`; `backend/lib/discovery/logistics-provider-matching.js` | Logistics Pack for assignment/coordination; Core Fulfillment for lifecycle; Inventory for stock consequence; Discovery for matching | **Reusable foundations; scheduling is contract/evaluation only** | Existing assignment lifecycle, courier scope, proof, workspace projection, delivery demand/capacity profiles and deterministic provider matching exist. L11 scheduling normalizes activity/time semantics; L11.6 feasibility is a pure evaluator that returns UNKNOWN without an authoritative capacity signal and does not persist or reserve. Its overlap check is tied to shared canonical references, not a general resource calendar. Matching is not selection, authorization, assignment, dispatch, or execution. Do not reopen frozen GAP-2 absent a demonstrated defect. |
| Commerce / Orders | `backend/lib/store-sqlite.js`; `backend/server.js`; `app/src/orders/*`; marketplace checkout and seller-order integration | Commerce | **Canonical reusable foundation** | Physical and service offerings can enter canonical order journeys. Marketplace checkout creates seller orders. Payment Core and Fulfillment remain separate authorities. Avoid a service-specific order store or another order lifecycle. |
| Supplier Network | `app/src/supplier-network/{capability,catalog,service-area,capacity}-contract.js`; `backend/lib/store-sqlite.js`; `backend/server.js`; `backend/lib/discovery/supplier-network-provider.js` | Supplier Network for supplier capability/capacity declarations; Organizations for identity; Product Catalog for product identity | **Reusable, supplier-domain-specific** | Profile, capability, catalog, service area, capacity, commercial terms, qualification, performance, trust, and deterministic discovery foundations exist. Capacity declarations carry quantity/unit, availability, period, visibility, and lifecycle. Supplier Network does not own inventory, procurement demand, payment, or marketplace seller identity. |
| Procurement sourcing | `app/src/procurement/ui.js`; `backend/lib/store-sqlite.js`; `backend/server.js`; Phase 17.1–17.9 regressions | Procurement | **Reusable, buyer-domain-specific** | Demand → supplier relationship → RFQ → response → comparison → award → PO bridge and receiving foundations exist. The PWA sourcing workspace is already present. Procurement remains the authority for demand and acquisition; it must consume supplier evidence rather than duplicate capacity. |
| Discovery / matching | `backend/lib/discovery/matching-contract.js`; `backend/lib/discovery/supplier-network-provider.js`; `backend/lib/discovery/logistics-provider-matching.js`; Phase 19.7 and L8-L10 matching regressions | Discovery for deterministic eligibility/matching; source domains own evidence | **Reusable cross-domain composition; temporal evidence wiring incomplete** | Matching supports capability, geography, capacity quantity/unit and other hard constraints. It is explicitly not trust scoring, supplier selection, authorization, reservation, or execution. Supplier Network provider normalization currently exposes a capacity-signal count in the sourcing summary; Phase 21.3's observed/valid-until evidence projection is not shown wired into that candidate path. Logistics provider matching uses capacity quantity/unit but its projection drops time validity. |
| Phase 21 capacity evidence | `app/src/phase21-capacity-availability-evidence.js`; `phase0/phase21.3-capacity-availability-regression.mjs` | Supplier Network remains source authority; Phase 21 owns projection semantics only | **Implemented projection; composition gap** | Projects capacity reference, subject, supplier, quantity/unit, observed/valid-until window, quality, provenance and metadata. It is immutable and persistence-free. It does not reserve inventory, create demand, mutate state, or execute providers. The inspected source has no demonstrated consumer wiring this projection into service booking or procurement RFQ eligibility. |

## 3. What is already reusable (preserve)

1. **One catalog identity.** Reuse the product/service identity contract; do not create a second service catalog.
2. **One order authority.** Service and physical offerings continue through Commerce Order.
3. **One payment authority.** Payment Core decides payment state; booking or fulfillment projections must not infer it.
4. **One inventory authority.** Supplier capacity declarations are not stock balances. Services are not stock-tracked.
5. **One booking lifecycle.** Extend existing Service Booking and its persistence/API/UI; do not introduce a generic booking database.
6. **One delivery assignment and fulfillment chain.** Logistics matching and workspace projections do not become dispatch authorities.
7. **One supplier identity.** Supplier Network and Procurement refer to the same Organization identity.
8. **One deterministic matching authority.** Extend Discovery matching inputs/evidence, not a parallel ranking service.
9. **One Procurement workflow.** Extend existing demand/RFQ/comparison/award/receiving stages.

## 4. Service Capability & Gap Register

Priority meanings: **P0** blocks reliable composition; **P1** materially improves reuse and operator/customer journeys; **P2** productization/scale after foundations.

| ID | Gap / capability to develop | Evidence from current source | Required outcome | Owning domain(s) | Priority |
|---|---|---|---|---|---|
| SC-01 | Time-sensitive availability query contract | Supplier capacity has declared periods and Phase 21.3 has observed/valid-until evidence; no demonstrated end-to-end consumer binding | Define a shared, versioned query/result vocabulary: subject/resource reference, requested interval, quantity + unit, geography/location, availability state, evidence quality, observed-at, valid-until, provenance, and explicit UNKNOWN/STALE/CONFLICTING handling. Read-only and non-authorizing. | Shared contract; Supplier Network, Service Booking, Logistics supply evidence | **P0** |
| SC-02 | Supplier capacity temporal and unit-aware eligibility | Capacity CRUD stores quantity/unit, period type/start/end, availability and status; deterministic matching has quantity/unit hard constraints; current Supplier Network provider surfaces a capacity count in its normalized summary | Wire valid capacity observations into the existing Discovery candidate path; enforce subject identity, active state, availability, period overlap/expiry and compatible units. Do not compare unlike units or treat a declaration as verified supply. | Supplier Network evidence + Discovery matching | **P0** |
| SC-03 | Service resource and appointment feasibility | Booking contract validates requested start/end and lifecycle, but the contract itself does not prove a provider/resource is free | Add a service-domain feasibility query for provider/resource, service duration, location/mode, working window, buffers and existing commitments. Return FEASIBLE / INFEASIBLE / UNKNOWN with evidence and freshness; no booking mutation in the feasibility step. | Service Booking / provider capability owner | **P0** |
| SC-04 | Conflict-safe booking commitment | Durable Service Booking lifecycle and versioned transitions exist; no source evidence in this audit establishes atomic resource-slot reservation or concurrent double-book prevention | Define the owner of a slot/resource commitment inside the service domain (or an explicitly identified existing scheduling authority). Commit must atomically recheck availability and prevent overlapping active commitments; idempotent replay and conflict response required. Keep booking lifecycle canonical. | Service Booking + existing Logistics Scheduling where applicable | **P0** |
| SC-05 | Procurement demand → supply evidence composition | Procurement demand/RFQ lifecycle and Supplier Network capacity exist independently; Discovery matching exists | Before preparing/sending RFQs, show supplier evidence against each demand line: product/capability match, quantity/unit compatibility, service area, requested-by/period fit, evidence quality and freshness. The result informs sourcing; it does not auto-award or create a PO. | Procurement + Supplier Network + Discovery | **P1** |
| SC-06 | Logistics provider temporal capacity composition | Logistics demand/capacity profiles and Discovery matching exist; selection/assignment/execution are deliberately separate | Reuse the availability vocabulary to express provider operating windows and capacity validity, then pass eligible candidates to existing selection/authorization/assignment steps. Do not add provider registry, route engine or dispatch store. | Logistics + Discovery | **P1** |
| SC-07 | Customer-facing service journey composition | Service catalog, marketplace service ordering, and operator booking workspace exist | Compose service listing → canonical checkout/order → payment status from Payment Core → booking request → feasibility/confirmation → service execution/completion. Clearly distinguish REQUESTED from CONFIRMED and UNKNOWN from success. | Catalog, Commerce, Payment Core, Service Booking | **P1** |
| SC-08 | Capability UI exposure and role-specific actions | Sourcing UI and service-booking operator UI exist; APIs enforce server authorization | Audit the actual capability-management UI for capacity/service-area/capability declarations and customer-side booking actions. Expose only existing API operations with permission-aware controls; UI role checks remain non-security. | Supplier Network, Service Booking, shared workspace UI | **P1** |
| SC-09 | Cross-domain evidence and audit trace | Existing domains emit their own audit/events; Phase 21.3 projection is persistence-free | Carry stable references to source evidence through feasibility and commitment results so operators can explain why a resource was shown as available and which evidence was used. Source-domain audit remains authoritative. | Each owning domain + Event/Audit | **P2** |
| SC-10 | Reusable capability packaging | Platform capability contracts, Packs and activation foundations exist | Map these existing capabilities into Packs/roles/dependencies and ensure install, activation, entitlement and authorization remain distinct. Do not make capability existence imply entitlement or execution permission. | Platform Core + Pack layer | **P2** |

## 5. Proposed dependency order

**Track A — Shared evidence vocabulary**
1. Specify SC-01 as a contract only; define explicit quality, time-window, unit and scope semantics.
2. Add adapters/projections from Supplier Network capacity and Logistics capacity into that vocabulary. Source domains remain owners.
3. Extend existing Discovery matching to consume evidence only when subject, unit, interval and freshness are comparable. Unknown evidence fails closed for hard requirements.

**Track B — Service feasibility and commitment**
4. The audit has now checked `app/src/verticals/logistics/scheduling-contract.js`, `scheduling-feasibility-contract.js`, and the Service Booking persistence regression: Scheduling is a pure contract/evaluation boundary (`persistence: none`, `mutation: none`), and ordinary service bookings intentionally do not create logistics activities.
5. Before implementation, identify the resource owner for each service class (for example, a provider-owned appointment resource vs a Logistics delivery resource). Extend that owning domain with resource-aware feasibility/commit and atomic conflict prevention. Do not assign all appointments to Logistics or create a universal reservation authority.
6. Integrate the customer/operator UI with the canonical API and preserve REQUESTED / ACCEPTED / CONFIRMED / IN_PROGRESS / COMPLETED distinctions.

**Track C — Procurement and Logistics composition**
7. Add capacity-aware evidence to the existing sourcing candidate and RFQ preparation flow.
8. Add temporal provider evidence to Logistics candidate matching, then hand off to existing authorization and assignment.
9. Complete cross-domain browser/HTTP/SQLite regressions and include them in CI.

## 6. Acceptance criteria for the first implementation slice

- [ ] Shared availability contract is immutable/versioned and owns no persistence.
- [ ] Quantity comparisons require compatible units; no implicit conversion without an explicit conversion authority/rule.
- [ ] Expired, stale, unknown, conflicting or missing observations never render as confirmed availability.
- [ ] Availability query is read-only and does not authorize, reserve, assign, order, pay or execute.
- [ ] Booking commitment rechecks feasibility atomically and rejects overlapping active commitments for the same resource.
- [ ] Idempotent retry returns the same canonical result; conflicting reuse is rejected.
- [ ] Tenant, organization, location and resource scopes are enforced server-side.
- [ ] UI presents REQUESTED, FEASIBLE, CONFIRMED, UNKNOWN and CONFLICT distinctly.
- [ ] Existing Commerce, Payment, Inventory, Fulfillment, Logistics, Supplier Network, Procurement, Event and Audit authorities remain intact.
- [ ] Focused tests and relevant cumulative CI gates run on Node 24 before any certification claim.

## 7. Audit limitations and verification status

This document is a source-grounded composition audit against the repository snapshot above. The follow-up inspection also verified the L11 scheduling and L11.6 feasibility contracts plus the service-booking scheduling-boundary regression. These confirm there is no existing general resource calendar or slot-commit authority in those contracts. The inspection verified source files and existing regression definitions, but did not execute the test suite in this environment. It does not certify the current runtime, CI status, or production behavior.

**No code, schema, migration, API, or authority was changed by this audit artifact.** The next code increment should begin only after inspecting the existing Logistics Scheduling/resource-commitment implementation for SC-03/SC-04 ownership, then implement the smallest missing slice.
