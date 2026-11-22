# Workstream A — Live Implementation Audit

**Audit date:** 2026-11-22  
**Repository:** `T-BOT-tech/sellify`  
**Baseline:** `main` at `5f83378c0885f6dc91c2649881fa1d0832d39ea4`  
**Implementation PR:** [#298](https://github.com/T-BOT-tech/sellify/pull/298) — `workstream-a/restaurant-canonical-inventory-batch`  
**Purpose:** Replace the earlier proposed-plan status with evidence from the current repository. This is a status audit, not a new architecture proposal.

## 1. Executive result

The old plan is still useful as a dependency map, but it must not be treated as a reliable implementation-status record.

- Stage 1 Service Booking commitment release is already implemented and covered by persistence regressions.
- Stage 2 contains mixed status: Restaurant has a canonical atomic batch bridge but no production Preparation caller; Warehouse's actual receiving/adjustment UI already calls canonical Inventory; Agriculture has a bridge but no discovered UI/API caller.
- Stage 3 L11 lifecycle persistence, authorization, command-key reuse protection, optimistic concurrency and terminal-state behavior are substantially implemented and tested.
- Stage 4 has backend contextual-role grant/revoke capability and authorization, but the current Membership Administration UI only manages generic membership roles.
- Workforce profile and workforce scheduling capabilities in Stages 5–6 were not found in the current application source.
- Stage 7's proposed cross-domain resource/capacity evaluation contract is not present. Existing Supplier Network, Service Resource and Logistics capacity models are domain-specific and must not be mistaken for the shared contract.
- Stages 8–9 are partial: some domain-specific scheduling, courier assignment and capacity declarations exist, but Workforce integration, vehicle lifecycle, Warehouse occupancy, coordinated multi-resource allocation and evidence-based utilization reporting remain open.

**No new Resource Registry, universal reservation ledger, second scheduler, Workforce identity store, or cross-pack orchestration authority is recommended.**

## 2. Stage-by-stage status

| Stage | Current status | Repository evidence and remaining work |
|---|---|---|
| 0 — Baseline | **COMPLETE for this audit** | Live `main` SHA and PR head checked; Node 24.22.3 is exercised by CI; relevant targeted and cumulative CI results are being tracked on PR #298. Keep PR unmerged pending final CI. |
| 1 — Service Booking commitment lifecycle | **IMPLEMENTED / VERIFIED** | `backend/lib/store-sqlite.js` transition path releases the commitment on completion/failure/cancellation as applicable. `phase0/service-booking-persistence-regression.mjs` verifies RELEASED state, authenticated actor, server timestamp, audit evidence, replay and reuse of the same resource/time interval. Do not reimplement this stage. |
| 2.1 — Restaurant canonical Inventory | **PARTIAL** | `app/src/verticals/restaurant/inventory-consumption.js` now submits all ingredients through one `recordCanonicalInventoryMovementBatch()` command. Backend `inventory.movement.batch.record` is processed in one SQLite transaction. Targeted regression covers batch shape, deterministic IDs, pending vs confirmed, confirmed replay and conflicting/pending local evidence. Remaining: no discovered persisted Preparation completion caller or Restaurant UI/API path invokes this bridge. |
| 2.2 — Warehouse canonical Inventory | **IMPLEMENTED for current receive/adjust paths** | `app/src/warehouse/ui.js` uses `recordCanonicalInventoryMovement()` for stock receipt and adjustment. `app/src/warehouse/procurement-receiving.js` uses the canonical procurement receipt endpoint with durable command outbox and explicit queued/unknown/confirmed states. Warehouse bridge/contract declarations were stale and are being reconciled to the canonical movement API. Remaining: the new vertical handoff contract is not the UI's execution path; avoid claiming Warehouse capacity/occupancy is implemented. |
| 2.3 — Agriculture canonical Inventory | **PARTIAL** | `app/src/verticals/agriculture/inventory-bridge.js` now calls `recordCanonicalInventoryMovement()`, checks active organization scope, preserves deterministic harvest event identity, validates confirmed replay intent and reports pending vs confirmed. No Agriculture UI module or production caller of `receiveHarvestIntoInventory()` was found. Harvest-to-Warehouse receiving and Logistics handoffs remain unconnected operational flows. |
| 3 — Logistics L11 scheduling lifecycle | **IMPLEMENTED / REGRESSION VERIFIED; capacity integration remains bounded** | `transitionLogisticsSchedulingActivity()` uses durable activity rows, required command keys, last-command replay, key-reuse conflict rejection, expected-version checks, explicit transition validation and authorization. Regressions cover lifecycle, terminal states, failure reasons, stale versions, key reuse, tenant isolation and authenticated HTTP. The current contract provides last-command replay, not a full historical command-result ledger. Feasibility remains UNKNOWN without trusted capacity evidence; do not weaken this fail-closed behavior. |
| 4 — Contextual Role Administration UI | **PARTIAL** | Backend `assignMembershipContextualRole()`, `revokeMembershipContextualRole()`, routes and authorization are present and covered by `phase0/gap-5-iam-membership-contextual-role-regression.mjs`. `app/src/authorization/membership-admin.js` currently lists memberships and edits generic roles only; it does not list, grant or revoke contextual role scopes. |
| 5 — Workforce foundation | **MISSING** | No Workforce domain module, employee/contractor profile persistence, department/position model or Workforce workspace was found. Identity, Organization and Membership remain the correct existing authorities. |
| 6 — Workforce scheduling and availability | **MISSING** | No employee shift templates/instances, leave/absence lifecycle, working-time constraints or Workforce availability projection/UI were found. Service Booking and Logistics must retain their existing lifecycles. |
| 7 — Shared resource capacity / multi-resource evaluation | **PARTIAL — domain-specific pieces exist; shared contract missing** | Service Resource availability/commitments, Supplier Network capacity signals, Phase 21 capacity evidence, Logistics L9 capacity profiles and L11 feasibility exist. They have different owners and semantics. No shared versioned Resource Reference + Capacity Declaration + Availability Evidence + FEASIBLE/CONFLICT/UNKNOWN contract spanning those domains was found. |
| 8 — Domain-specific allocation integration | **PARTIAL** | Service Booking commits Service Resources; Logistics has courier assignment, scheduling and capacity-profile/matching inputs. Missing: Workforce availability consumption, driver-plus-vehicle eligibility/lifecycle, Warehouse occupancy/capacity, and coordinated Service multi-resource commitment with explicit compensation/unknown semantics. |
| 9 — Utilization and operational analytics | **PARTIAL** | Logistics has a dynamic capacity-utilization policy contract and existing analytics patterns exist. No complete evidence-based Service/Workforce/Logistics/Warehouse utilization reporting surface was found. Scheduled/assigned counts must not be presented as consumed utilization. |

## 3. Corrections to outdated statements

1. **`applyStockChange()` is not the authenticated canonical mutation API.** In `app/src/warehouse/inventory.js`, it intentionally rejects local legacy stock mutation when an authenticated session or canonical inventory evidence exists. Authenticated vertical execution must use `app/src/warehouse/ledger.js#recordCanonicalInventoryMovement()` or the batch API.
2. The earlier Restaurant bridge's sequential `applyStockChange()` dependency was not sufficient for multi-ingredient atomicity. It has been replaced in PR #298 by one canonical Inventory batch event.
3. Warehouse UI receiving/adjustment already uses the canonical movement API; the earlier plan overstated the missingness of the Warehouse execution path. The bridge metadata was stale, not the whole UI path.
4. Agriculture's bridge existed, but its presence and contract tests did not prove that a production workflow called it. It is now aligned to canonical Inventory, but the actual user journey remains open.
5. Contextual-role backend capability does not mean contextual-role administration UI is complete.
6. Supplier Network capacity evidence and Logistics capacity profiles are not a universal Resource Registry or shared cross-domain capacity authority.
7. Node >=24 is a release requirement. CI has run on Node 24.22.3; this does not by itself certify every current PR check or authorize merging.

## 4. Changes made on PR #298 during this audit

- Restaurant ingredient consumption moved to one canonical atomic Inventory batch command.
- Restaurant confirmed-replay validation now distinguishes confirmed from pending local evidence and rejects event-ID reuse with changed movement intent.
- Warehouse receiving/adjustment bridge execution now delegates to the canonical Inventory movement API and exposes pending vs confirmed outcome.
- Agriculture harvest bridge now delegates to the canonical Inventory movement API and validates organization and replay intent.
- Cross-pack authority declarations, regressions and phase documents were reconciled where they still named the legacy `applyStockChange()` path.
- Current SHA-256 manifests were refreshed after the CI workflow changed.

No database migration or new Inventory authority was added.

## 5. Recommended remaining implementation order

1. Finish PR #298 CI and review; do not merge until all required checks pass.
2. Wire Restaurant Preparation completion to the atomic Inventory batch API, with an explicit persisted caller and user-visible pending/unknown/confirmed state.
3. Complete Agriculture's actual harvest-to-Inventory caller and UI/API workflow; then prove Warehouse receiving and Logistics handoff without conflating their success states.
4. Add contextual-role list/grant/revoke controls to the existing Membership Administration UI using the existing server endpoints.
5. Implement Workforce foundation, then Workforce scheduling/availability.
6. Only after the above evidence is stable, define the minimal shared cross-domain capacity/feasibility contract.
7. Integrate Workforce availability into Service Booking and Logistics; separately evaluate vehicle and Warehouse storage capacity needs.
8. Add utilization projections only where actual consumed/attendance/occupancy evidence exists.

## 6. Acceptance discipline

- A contract-only helper is not a completed user capability when a production caller/UI is required.
- A queued command is not confirmed execution.
- UNKNOWN is not SUCCESS; feasibility is not authorization; authorization is not execution.
- Domain-owned commitments and histories remain authoritative.
- A passing targeted test does not certify the full CI workflow.
- Keep PR #298 open and unmerged until current CI and code review are complete.
