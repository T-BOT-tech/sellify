# Sellify Implementation Register and Branch Policy

**Snapshot:** 2026-11-19  
**Mainline:** current `main` branch (consult GitHub for the live SHA).  
**Purpose:** prevent duplicate implementation, preserve canonical authority, and make integration decisions evidence-based.

This register is an operational control document, not a replacement for the FUX constitution, GAP exit criteria, source code, or the consolidated source-of-truth package.

## 1. Non-negotiable implementation rules

1. **Inspect before branching.** Before creating a branch, inspect current `main`, all open PRs, related branches, existing API/domain functions, migrations, and tests. Search by requirement and behavior, not only by branch name.
2. **One active implementation per task.** One task ID has one active implementation branch and one active PR. A second branch is allowed only for a declared dependency or a separately scoped task with no overlapping authority.
3. **Reuse or extend the existing authority.** UI/AI → API/integration boundary → capability → canonical authority → events/audit. Do not create a second ledger, booking authority, payment authority, fulfillment authority, logistics authority, or execution path.
4. **Declare dependencies.** A stacked PR must name its parent PR/base branch, unique changes, inherited changes, downstream dependents, and the intended integration root.
5. **Prove uniqueness.** Before merging, compare the candidate against its base and every overlapping PR. Classify each change as unique, inherited, duplicate, superseded, or deferred. PR title and commit count are not evidence.
6. **Test the exact commit.** Record the exact head SHA and exact Node 24 baseline, Phase 13.10.24, Logistics L18, Logistics exit-certification, and relevant domain regression results. A prior green run on another SHA is not a substitute.
7. **Integrate bottom-up.** Merge validated child work into one integration branch, preserving ancestry for stacked work. Keep one mainline PR for the resulting workstream.
8. **Close only after reconciliation.** Close a source PR only after its unique changes are merged or explicitly deferred and recorded. Preserve its branch until there are no open dependents and the final integration is verified.
9. **Delete only with evidence.** Before deleting a branch, verify its PR is merged/closed, its unique code is present in the integration target, no open PR uses it as a base/head, and the branch is not a required audit reference.
10. **No unsupported certification.** UNKNOWN is not SUCCESS. Node >=24 and all required exit gates remain explicit; do not claim final certification while any required gate is unresolved.

## 2. Required task/PR register fields

Every implementation task must record:

| Field | Required content |
|---|---|
| Task ID | Stable unique identifier |
| Requirement | Exact FUX/GAP/phase reference and acceptance condition |
| Canonical authority | Existing domain and owning functions/tables/APIs |
| Existing implementation | Relevant files, routes, functions, migrations, and tests |
| Related work | Open/closed PRs and branches with overlap |
| Active branch / PR | Single designated implementation path |
| Dependencies | Parent PRs and required integration base |
| Unique delta | What this task adds that is not already present |
| Tests | Existing regressions plus new regression(s) |
| Exact evidence | Commit SHA, Node version, workflow/run IDs, conclusions |
| Disposition | Planned, implementing, blocked, verified, integrated, superseded, deferred |

## 3. Current integration register

| Workstream | Integrated result | Evidence / reconciliation | Disposition |
|---|---|---|---|
| SC-03 resource commitment foundation | PR #256 merged at `642f4e8c4da22dfafb12f75a0d099ca50b871c33` | Exact code SHA `56bf4e02115e455bed7938679f0183682c476bf0` passed Node 24 baseline, Phase 13.10.24, Logistics L18, and Logistics exit certification. Merge-commit CI and release/logistics certifications also passed. | Integrated |
| Inventory atomic command and sync | Included in PR #256 mainline integration | #263/#267/#268/#270 merged into the integration root. FUX-46–FUX-52, replay runtime, sync authorization HTTP, atomic batch runtime/HTTP, Phase 10.5, and ledger opening-balance regressions passed. #264/#265/#266 closed as superseded. | Integrated |
| Migration 80/81 compatibility | Included in PR #256 | Runtime migration compatibility regression passed; #257 closed as superseded. | Integrated |
| On-site resource location scope | Included in PR #256 | Backend guard and persistence regression passed; #260 closed as superseded. UI workspace/browser deltas were separately integrated by #273. | Integrated |
| Location timezone persistence and availability | Included in PR #256 | Migration 82, FUX-57, persistence, effective location timezone, schedule drift, commitment-safe updates, UI notice, and availability regressions passed. #261/#262 closed as superseded. | Integrated |
| Appointments workspace and inline operator actions | PR #273 merged at `3b5854bfa0b4b0eac99f66071133a613f2fcaf51` | Exact head `cffb6895e480d16fb341c6c2d0f79e3a2b4fed12` passed all four required CI jobs. Added standalone Appointments navigation, role/scope-aware workspace, inline actions, and browser/navigation regressions. #258/#259 closed as superseded/deferred; issue #271 closed after integration. | Integrated |
| Restaurant Recipe foundation | PR #275 merged at `eb2fd3e49e3cdec6e00d892a4589a47dfd93751e` | Exact head `f294c849fd6a8ef49eea8b073a0707988f2de6f4` passed Node 24 baseline, Phase 13.10.24, Logistics L18, and Logistics exit certification. Recipe persistence/tenant-isolation regression passed. Recipe schema uses migration 83 after SC-03 migration 81 and location timezone migration 82; GAP-2.12 migration continuity regression was extended through 83 and passed. #269/#274 closed as superseded. | Integrated |
| Settings UX | PR #223 merged at `bcf1d28686d91e3ef2539fb9f59e52d88775f857` | Consolidated #220–#222: accessible/dismissible dialogs, first-use settings visibility, mobile workspace header, and progressive disclosure. Exact PR head `577ca4b215351f59d91ca3ddece943712f3695c2` passed required checks; merge-commit CI passed. | Integrated |
| First Experience persistence + Pack Recovery | PR #276 merged at `d5a0612fe6d75d1408ef2d2d65a9a56a6d2b9f10` | Exact head `d993c55ae4f271eb7f093f3a62e0e9b88a546670` passed all four required CI jobs. Durable IndexedDB tenant-session restoration, pre-reload persistence, async Pack Recovery readiness, stale-tenant repaint protection, and regressions are integrated. Issue #277's five named files were verified already present on main; workspace activation is production-wired and both workspace-activation/country-registry regressions passed in the exact Node 24 baseline. Issue #277 closed as completed. Country evidence registry remains a pure research metadata contract with no production consumer; further integration is deferred pending a product requirement. | Integrated; no remaining PR #214 code delta |
| UI evaluation environment | PR #278 merged at `ef130935056ed9611fa316f9df3b470f20b08934` | Exact head `f0580b3615701ae67d21a3eefa4f489ef5307c19` passed all four required CI jobs. Private Node 24 Codespaces configuration and evaluation guide are integrated. Codespace launch, forwarded-browser access, and manual visual review remain not runtime-verified. | Prepared; runtime verification pending |
| Service audit documents | Current-main audits added: `docs/SELLIFY_SERVICE_CAPABILITY_COMPOSITION_MAP_AND_GAP_REGISTER_2026-11-19.md` and `docs/SC03_SERVICE_RESOURCE_AND_APPOINTMENT_FEASIBILITY_SOURCE_AUDIT_2026-11-19.md` | The 14 Nov PR #225/#227 snapshots are stale: SC-03 resource, availability, commitment, customer/operator UI, and concurrency coverage are present; Phase 19.7 already evaluates declared temporal capacity. Capacity evidence integration is tracked separately by #281; the existing Phase 21.4 Demand Requirement contract remains distinct. Historical PRs #225/#227 are superseded and closed with evidence. | Current audit integrated; capacity evidence follow-up in PR #282 |
| Phase 21 Supplier Network capacity evidence follow-up | Draft PR #282 from `feat/phase21-4-capacity-evidence-integrity`; base `dcd7950aee8035df16b44beebf0ad77a114efd0e`; exact tested code head `2e73ac4fadb9035037a815ce686eb9b0434c8355` | Adds nullable observation/validity metadata in migration 84 without backfilling legacy timestamps; records server-side observation time on declaration refresh and preserves it across status-only transitions; Discovery time-window matching now requires an observation timestamp not later than server evaluation time and explicit validity through both evaluation time and requested window end, failing closed for unknown/expired evidence; carries evidence through existing Supplier Network and Logistics adapters; extends Procurement sourcing display; separates provenance/freshness/consistency in the existing Phase 21.3 projection. Full Sellify CI run `44589645898` passed on Node 24.22.2, including Phase 18.5, 19.5, 19.7, Logistics exit certification, Phase 21.3, Phase 21.14 (223 PASS / 0 FAIL), Phase 21.15, Phase 21.16, and the complete baseline. | Code and full CI verified on `2e73...`; draft, not merged; no production certification |
| Historical SC-03/Telegram branches | #237/#242 closed and retained as audit sources | Customer appointment deltas are already on main. The unique L11 Scheduling API/workspace is not ready to port until trusted capacity authority is defined; issue #272 closed and follow-up #280 opened. | Deferred to L11 authority decision |
| Audit/register reconciliation | PR #279 open | Corrects source-code baseline notes and records closure of #189, #272, #277, #225, and #227 plus the focused L11 follow-up #280. | Draft; do not merge until register/source review is complete |

## 4. Standard implementation workflow

### Preflight
- Search PRs, branches, source, routes, tables, migrations, and regressions for the requirement.
- Identify the canonical authority and current owner.
- Compare candidate branches and record merge-base, ahead/behind, changed-file overlap, and unique code.
- Choose the existing active branch or document why a new task/branch is necessary.

### Implementation
- Make the smallest change within the existing authority.
- Keep API/server authorization authoritative; UI visibility is not security.
- Keep migrations forward-only and idempotent; test upgrades from every supported legacy schema shape.
- Preserve transaction ownership and do not await while a shared SQLite transaction is open.
- Add a regression for the actual failure mode, not merely a static assertion where a runtime test is feasible.
- Allocate migration numbers only after checking current main and all open migration branches; never reuse a version number from a parallel workstream.

### Verification and integration
- Run focused regressions first, then exact-head Node 24 baseline and all required phase/workstream gates.
- Record exact SHA and run IDs in the PR.
- Integrate child work into the designated root branch; rerun CI on the new root SHA.
- Merge the root PR to main only after the exact root SHA is green.
- Close superseded source PRs with a comment identifying where their unique code landed.
- Delete branches only after dependency and code-presence checks.

## 5. Current execution boundary

**Integrated mainline:** SC-03/Inventory (#256), Appointments workspace (#273), Restaurant Recipe (#275), Settings UX (#223), First Experience/Pack Recovery (#276), and the private UI evaluation environment (#278) are merged to main. Current source audit docs are present on main; consult GitHub for the live `main` SHA.

**Mainline verification:** post-#256, post-#273, post-#275, post-#223, and post-#276 mainline runs passed all four required jobs. Exact-head PR runs for #273, #275, #223, and #276 passed all four required jobs. The #256 merge-commit security, release, and logistics certifications passed. PR #278's exact head passed all four required jobs; its merge-commit baseline and Phase 13.10.24 runs are still in progress as of this snapshot.

**Closed duplicate/deferred source PRs:** #189, #214, #217, #220–#222, #225, #227, #237, #241, #242, #257–#262, #264–#266, #269, #274, and the historical appointment stack #258/#259 are closed after their unique deltas were integrated, found already present, or explicitly deferred. Source branches are retained as audit references; no branch deletion is implied.

**Remaining open PR:** #279 (documentation/register reconciliation). Historical service audit PRs #225/#227 and stage-reconciliation PR #189 are closed as superseded.

**Deferred historical work:** issue #272 is closed after branch-by-branch audit; issue #280 tracks the distinct L11 Logistics Scheduling feasibility/API/workspace follow-up; issue #281 tracks the prerequisite Phase 21.4 freshness/quality evidence composition. Issue #277 is closed because the named workspace activation and country evidence files/tests were already in main. Appointment workspace issue #271 is closed because PR #273 integrated that work.

Node >=24 remains mandatory. The successful gates validate the integrated SC-03/Inventory, Appointments, Recipe, and Settings slices; they do not certify unrelated deferred platform work or every open documentation/evaluation PR.

## 6. Branch inventory snapshot (2026-11-19)

A full paginated inventory found **236 branches** and **274 pull requests**:
- **3 open PRs** remain: #225, #227, and #189.
- **159 PRs are merged** and **112 are closed without merge**.
- **15 branches** have no PR as head and are not bases of an open PR.
- All three open PRs target `main`; no feature branch is currently used as the base of an open PR.

### Untracked branch disposition

Four untracked branches are fully behind current main (zero commits ahead) and are candidates for archival after a final dependent-reference check:
- `feat/durable-service-booking-commands` — 0 ahead / 471 behind.
- `feat/sc034-service-resource-commitments-mainline-20261117` — 0 ahead / 256 behind.
- `fix/payment-ui-stale-state-regression-20261029` — 0 ahead / 421 behind.
- `test/service-booking-scheduling-boundary-current-main-20261029-v3` — 0 ahead / 427 behind.

The other untracked branches are **not safe for bulk deletion**. They contain divergent or ahead commits and need targeted delta review. Examples include:
- Historical appointment/service branches: `feat/sc03-5-location-timezone-availability-v2`, `feat/sc03-customer-appointment-journey-20261115`, `feat/sc03-service-booking-atomic-commitment`, and `feat/sc03-service-booking-atomic-commitment-authority`. Track unique behavior through issue #272; do not merge wholesale.
- Older Logistics model branch: `feat/logistics-service-delivery-model-20261018`.
- `fix/logistics-delivery-proof-immutability`: its older proof mutation path is superseded by current main's stronger canonical/legacy proof comparison and immutable-proof guard; retain until the exact branch delta is checked against the GAP-2 regression.
- `fix/service-opening-balance-boundary`: its older opening-balance logic is superseded by current main's canonical-ledger `NOT EXISTS` guard and service-item exclusion; retain until the exact branch delta is checked against the Inventory replay regression.
- `gap-1/notification-auth-contract`, `test/marketplace-order-payment-settlement-http-journey-20261101`, `test/tenant-creation-response-loss-current-main`, and `ux/home-command-center-attention-01` need focused ownership/delta review before archival.

**Cleanup decision:** do not delete branches in bulk. Archive/delete only the four zero-ahead candidates after confirming no hidden dependency or audit requirement; retain divergent branches until their unique deltas are either ported, explicitly deferred, or rejected with evidence.
