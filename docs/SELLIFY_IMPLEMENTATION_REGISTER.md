# Sellify Implementation Register and Branch Policy

**Snapshot:** 2026-11-21  
**Source-code baseline:** `190f9e1bb15a04bae5e58ed0d981e5d9cd0271f3` (PR #291 merge); subsequent commits in this documentation reconciliation are documentation-only.  
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
| Phase 21 Supplier Network capacity evidence | PR #282 merged at `befebd9053b92cdd8b029554d4c9878d7de820c7` | Adds nullable observation/validity metadata in migration 84 without fabricating legacy timestamps; records server-side observation time on declaration refresh and preserves it across status-only transitions; Discovery time-window matching requires valid, time-bounded evidence and fails closed for unknown/expired evidence; preserves Supplier Network and Logistics source ownership and Discovery matching ownership. Exact PR head `b23cd5db97f3a69e9d541eaf5d5fbb2c913d6f0a` passed all five Sellify CI jobs and Repository Security Checks. The subsequent mainline after PRs #286 and #283 also passed Node 24 baseline, Phase 13.10.24, Logistics L18, Logistics exit certification, Repository Security Checks, Logistics Runtime Certification, and Release Certification. | Integrated; not production certification |
| Historical SC-03/Telegram branches | #237/#242 closed and retained as audit sources | Customer appointment deltas are already on main. The unique L11 Scheduling API/workspace is not ready to port until trusted capacity authority is defined; issue #272 closed and follow-up #280 opened. | Deferred to L11 authority decision |
| Audit/register reconciliation | PR #279 merged at `dcd7950aee8035df16b44beebf0ad77a114efd0e` | Reconciles the November 19 service audits, source baseline, and issue/PR dispositions. | Integrated |

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

**Integrated mainline:** SC-03/Inventory (#256), Appointments workspace (#273), Restaurant Recipe (#275), Settings UX (#223), First Experience/Pack Recovery (#276), private UI evaluation environment (#278), Supplier Network capacity evidence (#282), audit/register reconciliation (#279), and the Service Booking audit-evidence correction (#291) are merged to main.

**Current mainline:** `190f9e1bb15a04bae5e58ed0d981e5d9cd0271f3` (PR #291 merge commit).

**Verification evidence:** PR #282's exact head passed all five Sellify CI jobs and Repository Security Checks; its subsequent mainline passed the Node 24 baseline, Phase 13.10.24, Logistics L18, Logistics exit certification, Repository Security Checks, Logistics Runtime Certification, and Release Certification. PR #291's exact head passed the required Node 24 baseline, Phase 13.10.24, Phase 21.4 capacity evidence, Logistics L18, Logistics exit certification, Repository Security Checks, and SC-03 regressions before squash merge. Do not infer a new post-merge workflow run on #291's merge commit from those pre-merge checks.

**Open pull requests:** none in the live repository check on 2026-11-21.

**Deferred boundaries:** the distinct L11 Logistics Scheduling API/workspace remains a separate feasibility decision; do not introduce it as a second scheduling or booking authority. Service appointment feasibility and Supplier Network/Logistics capacity evidence remain separate from logistics execution, inventory reservation, procurement commitment, and payment settlement.

Node >=24 remains mandatory. Passing CI is not production certification; deployed runtime, persistent production storage, and production backup/restore remain separate operational acceptance gates.

## 6. Branch inventory snapshot (2026-11-21)

A complete paginated GitHub branch inventory found **8 branches total**: `main` plus the seven retained reference branches. The repository had **no open pull requests** at the time of verification.

### Active development baseline

- `main` — the only active development baseline.

### Retained reference branches

These seven branches are preserved for selective historical reference. They are not active implementation branches and must not be merged wholesale:

- `docs/audit-register-reconcile-20261119` — historical audit/register reconciliation.
- `feat/country-evidence-source-registry-20261108` — country evidence registry reference.
- `feat/first-experience-entry-readiness` — First Experience readiness reference.
- `feat/onboarding-country-pack-integrity` — country onboarding reference.
- `feat/payments-evidence-status-read-20261031` — Payment frontend integration reference.
- `feat/phase21-4-capacity-evidence-integrity` — Phase 21.4 capacity evidence implementation reference.
- `feat/workstream-a-inventory-batch-command` — inventory batch-command reference.

The seven references have different levels of divergence from current main. Treat them as read-only historical sources until a specific missing behavior is proven on current main and a narrow delta is reviewed. Branch retention does not imply that the code is missing, approved, or safe to merge.

**Cleanup result:** branch count reduced from 248 to 8. The former `feat/advanced-outbox-recovery-current-main` reference was also deleted by the repository owner. No application code was changed by this branch cleanup.
