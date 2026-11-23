# Capacity evidence and Logistics Scheduling boundary

Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`.

## Executive boundary

**Logistics Scheduling must remain request-only for hard operational decisions until a trusted operational capacity/feasibility authority is available and integrated server-side.** The current implementation enforces this fail-closed: scheduling evaluation sets `externalEvaluation = null`; the feasibility contract returns `UNKNOWN / NO_AUTHORITATIVE_CAPACITY_DECISION` when no authoritative result exists; the decision contract blocks UNKNOWN; and the store rejects a transition to `SCHEDULED` with `SCHEDULING_FEASIBILITY_UNKNOWN`.

This is an existing safe boundary, not a request to build a new authority. Discovery remains a matching/ranking authority; Supplier Network remains the source of supplier-declared capacity evidence; Logistics Scheduling owns only its request/lifecycle records. Do not add a second Supplier Network, Logistics, Inventory, or capacity authority.

## 1. Supplier Network capacity evidence: current source facts

### Persistence schema

`backend/lib/store-sqlite.js:1924` defines `supplier_network_capacity_signals` with:

- organization, subject type/id, quantity, unit;
- period type/start/end and availability;
- visibility and active/inactive status;
- `source TEXT ... CHECK (source = 'DECLARED')`;
- `created_by_user_id` and `updated_by_user_id`;
- metadata JSON, timestamps and version.

It has **no** typed `observed_by`, independent observer identity, verifier identity, verification reference, or signed provenance record. The creator/updater identity proves who entered/edited the declaration, not who independently observed operational capacity.

### Supplier Network contract and projection

- `app/src/supplier-network/capacity-contract.js` declares `source: 'DECLARED_ONLY'`; observed performance is described as a future authority.
- `backend/lib/discovery/supplier-network-provider.js:30-45` projects capacity as source `DECLARED`, quality `SELF_REPORTED` when `observedAt` exists, otherwise `UNKNOWN`; provenance says `supplier_declaration`.
- `app/src/phase21-capacity-availability-evidence.js:118-122` derives provenance from the source, forces quality to `SELF_REPORTED` for declared sources and `UNKNOWN` otherwise, and explicitly ignores caller-supplied `OBSERVED`/`VERIFIED` labels. The projection can carry a provenance object, but it does not authenticate an observer or bind it to a trusted identity.
- `backend/lib/store-sqlite.js:4397-4430` captures RFQ-time evidence snapshots. It records quantity, unit, period, availability, status, observedAt, validUntil, quality, freshness and capture time. It does not record an independent observer identity or verification provenance. Snapshot immutability is useful evidence preservation, not independent verification.

### Consequence

The current Supplier Network capacity authority is a **supplier declaration** authority. It is not an independently observed operational capacity authority. A future OBSERVED/VERIFIED hard-decision path requires a trusted observer/service identity, an authorization policy for that observer, a durable evidence reference and provenance that cannot be self-asserted by the supplier or caller. A free-form provenance JSON field or caller-provided `verified_by` string is not sufficient.

The separate `app/src/verticals/logistics/provider-verification-contract.js` is a pure scoped capability-evidence contract. It requires non-empty `verified_by`, `verified_at`, and `evidence_reference` for VERIFIED provider capability evidence, but those are caller-provided strings; the contract has `provider_trust_authority: false`, `persistence: 'none'`, and does not bind the verifier to Identity or a trusted independent observer. It must not be treated as capacity verification authority.

## 2. Capacity consumers

| Consumer | Evidence behavior | Decision weight | Classification |
|---|---|---|---|
| `discoverSupplierNetwork` — `backend/lib/store-sqlite.js:4741+` | Reads ACTIVE, buyer-visible signals. Optional `minimumQuantity` filters the capacity scoring subset; it does not check time period, validity, observation quality, or unit. A match adds a score; it does not reserve capacity or exclude the supplier from all results. | Soft supplier-discovery score | Legacy quantity-only discovery consumer |
| `capacityMatches` — `backend/lib/discovery/matching-contract.js:74-140` | Without a time window, a requested minimum quantity checks subject/quantity and optional unit but does not require ACTIVE status, quality, freshness, validUntil or period overlap. With an availability window it requires matching subject, optional unit, ACTIVE, SELF_REPORTED, valid observedAt/validUntil, valid period overlap, AVAILABLE/LIMITED and sufficient quantity. | Discovery eligibility/ranking, not operational execution | Bounded path is evidence-aware; non-temporal path remains quantity-only |
| `discoverUnified` + Supplier Network provider — `backend/lib/discovery/unified-discovery.js`, `supplier-network-provider.js` | Calls canonical Discovery matching. Time-bound intent reaches the bounded matcher. Non-temporal intent uses the quantity-only branch above. | Candidate eligibility and deterministic ranking | Discovery-only; no selection, authorization, reservation or execution |
| `matchLogisticsProviders` — `backend/lib/discovery/logistics-provider-matching.js` | Maps provider capacity signals to Discovery vocabulary; time window is optional. Returns `selection: not_performed`, `authorization: not_performed`, `execution: false`, `persistence: none`. | Suitability matching only | No production caller found; referenced by regression tests only |
| `logistics-capacity-profile-contract.js` | Compares declared `payload_capacity_kg` to requested payload; no trusted time-bound capacity evidence. | Pure contract | No production consumer found; test/master-audit use only |
| `dynamic-capacity-utilization-contract.js` | Pure utilization projection with time-window concepts; no persistence or capacity authority. | Pure contract | No production caller found; regression-test use only |
| Procurement sourcing UI — `app/src/procurement/ui.js` | Displays immutable RFQ snapshot quantity, unit, availability, quality, freshness, observedAt and validUntil. Labels it read-only and not a reservation, verification, supplier selection or authorization. | Display only | Not a decision consumer |

### Hard-decision assessment

No identified production consumer currently converts a quantity-only Supplier Network declaration into a hard Logistics scheduling, provider-selection, dispatch, fulfillment, or Inventory decision. The direct Supplier Network discovery path and the non-temporal Discovery matcher can affect candidate inclusion/score, but they do not authorize execution. The time-bounded Discovery path is stricter, but remains a discovery eligibility/ranking result—not an operational capacity commitment.

The legacy quantity-only paths should remain visibly labelled as discovery hints. Do not silently upgrade their output to `FEASIBLE`, `AVAILABLE`, `RESERVED`, or `CONFIRMED`.

## 3. Logistics Scheduling boundary

### API and authorization

`backend/server.js:3338+` — `handleLogisticsScheduling`:

- GET requires `logistics:scheduling:view`, validates tenant and location scope.
- POST request requires `logistics:scheduling:request`, a required Idempotency-Key, and creates an activity.
- Evaluation is read-only and requires view access.
- Transition uses the activity's tenant/location context; the store enforces action-specific `logistics:scheduling:confirm`, `logistics:scheduling:cancel`, or `logistics:scheduling:manage` authorization.
- UI role visibility is not the authorization boundary; server authorization is.

### Persistence and fail-closed evaluation

- `createLogisticsSchedulingActivity` — `backend/lib/store-sqlite.js:11105+` — persists a `REQUESTED` activity under a SQLite transaction, with organization scope, idempotency and request fingerprint/version handling.
- `evaluateLogisticsSchedulingActivity` — `backend/lib/store-sqlite.js:11289+` — checks only existing scheduling records and canonical Order/Fulfillment/Movement references for overlap. It explicitly sets `externalEvaluation = null`; caller-supplied capacity/feasibility assertions are not trusted.
- `transitionLogisticsSchedulingActivity` — `backend/lib/store-sqlite.js:11362+` — requires an idempotency key, uses `BEGIN IMMEDIATE`, applies authorization and location scope, and for a transition to `SCHEDULED` re-evaluates feasibility with `externalEvaluation: null`. If the decision is not SCHEDULE, it throws 409 (`SCHEDULING_FEASIBILITY_UNKNOWN` or conflict).
- `app/src/verticals/logistics/scheduling-feasibility-contract.js:141+` returns UNKNOWN when there is no authoritative external capacity decision; all results set `authorized: false`, `execution: false`, `persistence: 'none'`, `mutation: false`.
- `app/src/verticals/logistics/scheduling-decision-contract.js:29+` blocks UNKNOWN and CONFLICT. FEASIBLE can permit the scheduling decision only; it still returns `authorized: false`, `execution: false`, and `persistence: 'none'`.

This is the required boundary: Scheduling may record a request, inspect known conflicts and expose an UNKNOWN feasibility result. It cannot claim a physical resource is available, reserve it, select a provider, dispatch a courier, mutate Fulfillment, or execute Inventory/Payment consequences.

The future SCHEDULED/CONFIRMED/IN_PROGRESS lifecycle branches do not create capacity authority. The normal API path cannot enter SCHEDULED until a trusted server-side feasibility authority is integrated. Existing/legacy SCHEDULED records, if present, should be treated as separately sourced historical state.

## 4. Trusted observer / provenance gap

Before accepting OBSERVED or VERIFIED capacity evidence for a hard operational decision, the system still needs:

1. A trusted observer/service identity bound to Identity and an authorized organization/resource scope—not a free-form `verified_by` string.
2. A durable evidence record/reference and immutable provenance: observer identity, method, source, subject, quantity/unit, observation time, validity, operational period, organization/location/resource scope and verification outcome.
3. Server-side verification of the evidence source and observer permission. Supplier/caller-supplied quality labels must remain ignored.
4. A canonical operational feasibility/capacity decision that checks time overlap, quantity/unit and already committed/reserved capacity, with concurrency-safe revalidation at the authoritative mutation boundary.
5. A server-side adapter from Scheduling to that existing authority. Scheduling consumes the decision; it does not create another capacity ledger.

No new authority should be created in this audit. Until the trusted authority exists, retain request-only behavior and UNKNOWN blocking.

## 5. Regression and CI evidence

- `phase0/phase18.5-supplier-network-capacity-regression.mjs`: Supplier Network capacity persistence; direct step in `ci.yml` job `phase21_capacity_evidence`.
- `phase0/phase19.7-deterministic-matching-regression.mjs`: Discovery matching; direct step in the same main CI job.
- `phase0/phase21.17-capacity-evidence-migration-regression.mjs`, `phase21.18-current-verification-regression.mjs`, and `phase21.20-procurement-rfq-capacity-evidence-snapshot-regression.mjs`: run in `.github/workflows/supplier-network-capacity-evidence.yml`. That workflow's push trigger is restricted to `audit/supplier-network-capacity-evidence-ci-20261123`; its pull_request trigger is path-filtered. It is not a general main-push workflow.
- `phase0/sc02-supplier-capacity-temporal-eligibility-regression-gate.mjs`: orchestrates seven relevant regressions (Supplier Network discovery, provider projection, deterministic temporal matching, Logistics provider projection, Procurement UI traceability, Phase 21.19 display and Phase 21.20 snapshot). It is not registered as a root npm script and is not directly referenced by the current CI workflow inventory.
- Main `ci.yml` baseline directly runs Logistics Scheduling L11.1, L11.3–L11.7, authenticated HTTP and UI regressions. The L11.8 decision regression has multiple npm aliases to one file, but no direct workflow reference was found in the current workflow inventory.

The tests characterize current fail-closed behavior and snapshot integrity; they do not supply the missing trusted observer or operational capacity authority.

## Audit conclusion

- **Discovery:** retain bounded time-window matching for discovery eligibility; keep quantity-only results as non-authoritative hints.
- **Supplier Network:** declarations remain the only accepted capacity provenance; do not accept caller-asserted OBSERVED/VERIFIED.
- **Procurement:** RFQ snapshots preserve visible supplier declarations immutably; they are not capacity reservations or supplier selection.
- **Logistics Scheduling:** keep request-only; UNKNOWN blocks SCHEDULED; no dispatch or fulfillment execution.
- **Next prerequisite:** trusted observer identity/provenance and an existing server-side operational capacity/feasibility authority. Do not create a duplicate authority inside Scheduling.
