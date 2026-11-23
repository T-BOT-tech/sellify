# Capacity evidence and Logistics Scheduling boundary

- Source baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Status: evidence-backed boundary map; no operational scheduling authority is approved or created.

## Executive boundary

Supplier Network owns supplier-declared capacity evidence. Discovery consumes that evidence to produce read-only matching results. Procurement owns immutable RFQ-time evidence snapshots. Logistics Scheduling owns request/coordination records only. No current server-side operational capacity/feasibility authority is wired into Scheduling.

**Scheduling must remain request-only.** A supplier declaration, Discovery match, RFQ snapshot, capacity profile, or caller-provided `FEASIBLE` label is not an operational authorization.

## 1. Supplier Network capacity evidence source

Evidence:
- `backend/lib/store-sqlite.js:3901` — `normalizeSupplierNetworkCapacityInput` validates subject type/id, positive quantity, unit, period, availability, visibility and optional `validUntil`. It does not accept a trusted observer identity or an evidence-quality claim.
- `backend/lib/store-sqlite.js:3952` — `upsertSupplierNetworkCapacity` requires an active Supplier Network participant/actor, writes `source='DECLARED'`, stamps `observed_at` from server `nowIso()`, persists the supplier actor as created/updated user, and validates that `validUntil` is not earlier than observation time.
- `backend/lib/store-sqlite.js:1924` — base table `supplier_network_capacity_signals` has organization FK, subject, quantity/unit, period, availability, visibility, source constrained to `DECLARED`, status, metadata and supplier-side created/updated actor IDs. Migration 84 adds `observed_at` and `valid_until`.
- `phase0/phase21.17-capacity-evidence-migration-regression.mjs` verifies migration 84 restores the two columns and preserves legacy null values rather than fabricating observation/validity timestamps.

Interpretation:
- `observed_at` is server-authored observation time for a supplier declaration; it is not an independent observer's attestation.
- `created_by_user_id` and `updated_by_user_id` identify the supplier-side actor. They do not establish a trusted external observer or evidence provenance.
- The schema's `source` constraint prevents self-asserting another source; the provider normalizer derives `SELF_REPORTED` only when a server observation timestamp exists, otherwise `UNKNOWN`.
- There is no independent observer identity, verifier organization, verification method, trusted evidence reference, or signed provenance binding in this source contract.

## 2. Strict unified Discovery time-bound matching

Evidence:
- `backend/lib/discovery/matching-contract.js:74` — `capacityMatches` applies hard constraints when availability dates or minimum quantity are requested.
- `backend/lib/discovery/supplier-network-provider.js:14` — provider search delegates candidate discovery to the existing `discoverSupplierNetwork` store authority; `:29` normalizes declarations as `source='DECLARED'`, `quality='SELF_REPORTED'` when `observedAt` exists, otherwise `UNKNOWN`, and labels provenance as supplier declaration.
- `backend/lib/discovery/unified-discovery.js:31` — providers are searched, normalized, passed to `matchDiscoveryCandidates`, then ranked. Discovery remains deterministic, read-only and non-executing.
- `backend/server.js:2945` — unified Supplier Network federation requires tenant context, a session and `supplier-network:discovery:discover`.
- `app/src/procurement/ui.js:217` — Procurement sourcing UI calls `/api/discovery`; it displays declared capacity, period, validity, quality and freshness.

For a time-bound hard constraint, the matcher requires:
- A valid requested `availabilityFrom` and `availabilityTo`, plus product or capability identity.
- Matching subject, requested unit, active signal status, and `SELF_REPORTED` quality.
- Parseable `evaluatedAt`, `observedAt` and `validUntil`; observation cannot be in the future and validity must cover both evaluation time and the requested end.
- Valid period start/end with overlap against the requested window.
- Availability of `AVAILABLE` or `LIMITED`, and sufficient quantity when requested.

`OBSERVED` and `VERIFIED` are deliberately not accepted for hard time-bound matching: the matcher explicitly states that a trusted observer binding is not yet part of the provider contract. This is the correct fail-closed behavior until provenance exists.

## 3. Legacy quantity-only Supplier Network discovery consumer

Evidence:
- `backend/server.js:1516` — `handleSupplierNetworkDiscovery` requires tenant session and `supplier-network:discovery:discover`, then calls `discoverSupplierNetwork` directly and returns its result.
- `backend/lib/store-sqlite.js:4741` — `discoverSupplierNetwork` reads active visible capacity signals and filters by product/capability subject; when `minimumQuantity` is supplied it filters on quantity and scores the signal.

Boundary gap:
- This direct legacy endpoint does not apply `availabilityFrom`, `availabilityTo`, `unit`, `observedAt`, `validUntil`, freshness, or period-overlap checks to its capacity ranking.
- The same store function is also used by the unified Supplier Network provider, but the unified flow subsequently passes normalized candidates through the strict matcher. The direct legacy HTTP handler does not.
- Therefore, the strict Discovery guarantee must not be generalized to every call of `discoverSupplierNetwork`.

Decision: keep this direct endpoint advisory/discovery-only. Do not use its quantity score as a hard time-sensitive availability or scheduling decision. Any future consolidation must preserve the unified matcher and avoid a second Supplier Network authority.

## 4. Procurement RFQ-time evidence snapshot

Evidence:
- `backend/lib/store-sqlite.js:4397` — `procurementCapacityEvidenceSnapshotForSupplier` captures active, buyer-visible PRODUCT capacity signals for products in the demand.
- `phase0/phase21.20-procurement-rfq-capacity-evidence-snapshot-regression.mjs` verifies capture time, visible-product filtering, ignores client-supplied evidence, labels current declarations `SELF_REPORTED/CURRENT`, labels legacy records `UNKNOWN/UNKNOWN`, and proves the snapshot is immutable after supplier declarations change and on idempotent replay.

Interpretation:
- The RFQ snapshot preserves evidence state at RFQ creation; it is not a live availability decision, reservation, or scheduling authorization.
- The snapshot retains legacy unknown evidence with explicit quality/freshness labels rather than silently upgrading it.
- Supplier Network remains the source authority; Procurement owns the immutable historical snapshot.

## 5. Logistics provider capacity contracts and matching

- `app/src/verticals/logistics/logistics-capacity-profile-contract.js` is a pure declarative capacity-profile contract (vehicle/payload/service profiles, operating area, availability/schedule metadata). It does not persist capacity or reserve/assign/dispatch/schedule.
- `backend/lib/discovery/logistics-provider-matching.js` is a provider-neutral matching helper that uses the shared Discovery matcher; repository call-site search found tests/contracts but no production scheduling integration.
- These contracts are not a trusted operational capacity source. They must not be treated as one.

## 6. Logistics Scheduling is request-only and fail-closed

Evidence:
- `backend/lib/store-sqlite.js:11289` — `evaluateLogisticsSchedulingActivity` reads existing scheduling activities, sets `externalEvaluation = null`, and passes that null to `evaluateLogisticsSchedulingFeasibility`. Caller-supplied feasibility claims are not trusted.
- `backend/lib/store-sqlite.js:11362` — `transitionLogisticsSchedulingActivity` runs an idempotent transaction, checks logistics scheduling authorization and location scope, and when target is `SCHEDULED` reevaluates with `externalEvaluation: null`. It rejects any decision other than `SCHEDULE` with a conflict/unknown error.
- `app/src/verticals/logistics/scheduling-feasibility-contract.js:141` — pure evaluator distinguishes conflict, unknown and feasible; absence of physical capacity evidence is not interpreted as capacity.
- `phase0/logistics-scheduling-feasibility-service-regression.mjs` verifies caller-supplied camelCase and snake_case `FEASIBLE` claims are ignored, result remains `UNKNOWN/NO_AUTHORITATIVE_CAPACITY_DECISION`, execution stays false, and a transition to `SCHEDULED` is rejected.

Current scheduling authority is therefore a request/coordination queue with local conflict detection, not a physical capacity authority or dispatch engine.

## 7. Missing trust and operational authority

Required before hard operational decisions:
1. Trusted independent observer identity (person/system and organization) distinct from the supplier actor.
2. Provenance contract: evidence source, method, reference, observation time, verification time, verifier identity, authorization and tamper-evident binding.
3. Server-side acceptance rules for `OBSERVED` and `VERIFIED`; no client-supplied quality flag may elevate a declaration.
4. One operational capacity/feasibility authority that owns physical resource availability and can return a durable, scoped, authenticated decision.
5. Adapter contract for external capacity sources, with provider trust, freshness, validity, idempotency, error taxonomy and reconciliation.
6. Scheduling integration that consumes the trusted decision without creating a second Inventory, Fulfillment, Supplier Network or Logistics authority.

## 8. Safe boundary and decision

```text
Supplier Network
  owns supplier declarations + server observation/validity metadata
       │
       ▼
Discovery
  read-only matching; strict time-bound eligibility only in unified path
       │
       ├──> Procurement
       │      owns immutable RFQ-time evidence snapshot
       │
       └──> Logistics Scheduling
              request-only until trusted operational capacity/feasibility authority exists
```

- Preserve Supplier Network as evidence source.
- Preserve Discovery as read-only matching/ranking.
- Preserve Procurement as RFQ snapshot owner.
- Preserve Logistics Scheduling as request-only.
- Do not create another capacity matcher or second domain authority.
- Do not allow a Discovery score or RFQ snapshot to authorize scheduling.
- Do not change source code or scheduling behavior until the trusted observer and operational authority contracts are approved and tested.