# Sellify Implementation Register and Branch Policy

**Snapshot:** 2026-11-19  
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

| Workstream | Current candidate | Reconciliation status | Next action |
|---|---|---|---|
| SC-03 resource commitment foundation | PR #256, `feat/sc03-mainline-integration` | Integration root; includes #263 and #267 | Finish exact-head Node 24 and required regression gates before mainline merge |
| Inventory atomic command and sync | PR #256 integration root; source PRs #263/#267/#268/#270 merged into this branch | Replay integrity, provider eligibility, atomic command, sync authorization, batch sync, transaction no-yield, and ledger opening-balance correction reconciled | Verify full root CI; do not merge source PRs independently |
| Migration 81 compatibility | Ported from #257 into #256 branch | Runtime compatibility regression wired into CI | Verify exact root run; close #257 as superseded after green |
| On-site resource location scope | Ported from #260 into #256 branch | Server-side fail-closed check and persistence regression added | Verify exact root run; close #260 as superseded after green |
| Location timezone persistence | Ported from #261 into #256 branch; migration 82 | UI/API/store persistence and migration regression wired into CI | Verify exact root run; close #261 as superseded after green |
| Location-aware availability | Ported from #262 into #256 branch | Effective timezone, schedule drift, commitment-safe updates, UI notice, and regression wired into CI | Verify exact root run; close #262 as superseded after green |
| Appointment workspace navigation | PR #258 | Not ported; UI branch differs materially from #256 and needs role/navigation reconciliation | Keep isolated; do not merge wholesale |
| Inline appointment operator forms | PR #259 | Not ported; depends on #258 UI branch and requires a focused UI patch against current mainline | Keep isolated; do not merge wholesale |
| Restaurant Recipe foundation | PR #269 | Separate feature; earlier CI failures were in inherited service/baseline journeys and need fresh exact-base diagnosis | Retarget to the integration root after it stabilizes; rerun exact Node 24 CI |
| Settings UX | PR #223 | Candidate consolidates #220–#222 features | Validate exact head, then merge once the mainline integration is stable; close #220–#222 as superseded |
| First Experience | PR #214 | Broad first-experience bundle; CI evidence exists but base is stale | Reconcile changed files and retest against updated main |
| Service audit documents | PRs #225 and #227 | Historical snapshots; parts are superseded by SC-03 implementation | Update evidence/status before merging; do not merge stale claims |
| Earlier SC-03/Telegram branches | PRs #237 and #242 | Divergent historical source branches with overlapping and unique deltas | Extract unique requirements into focused tasks; never merge either branch wholesale |
| Stage reconciliation documentation | PR #189 | October snapshot is stale against current implementation | Refresh against the final integrated code before merging |

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

### Verification and integration
- Run focused regressions first, then exact-head Node 24 baseline and all required phase/workstream gates.
- Record exact SHA and run IDs in the PR.
- Integrate child work into the designated root branch; rerun CI on the new root SHA.
- Merge the root PR to main only after the exact root SHA is green.
- Close superseded source PRs with a comment identifying where their unique code landed.
- Delete branches only after dependency and code-presence checks.

## 5. Current execution boundary

The current integration branch is a candidate, not a certification. Migration 81/82, on-site location scope, location-aware availability, Inventory replay/auth/batch, and shared SQLite transaction safety must all pass together on the final exact head. Node >=24 remains mandatory. No production certification is implied by a component-level green run.
