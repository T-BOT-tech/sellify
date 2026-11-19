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
| SC-03 resource commitment foundation | PR #256 merged to `main` at `642f4e8c4da22dfafb12f75a0d099ca50b871c33` | Exact code SHA `56bf4e02115e455bed7938679f0183682c476bf0` passed all required CI jobs; merge-commit CI and release/logistics certifications also passed | Integrated |
| Inventory atomic command and sync | PR #256 integration root; #263/#267/#268/#270 merged into this branch | FUX-46–FUX-52, replay runtime, sync authorization HTTP, atomic batch runtime/HTTP, Phase 10.5, and ledger opening-balance regression all passed; #264/#265/#266 closed as superseded | Complete in integration branch; merge only through #256 |
| Migration 81 compatibility | Ported from #257 into #256 branch | Runtime compatibility regression passed; #257 closed as superseded, branch retained | Complete |
| On-site resource location scope | Backend guard and persistence regression ported from #260 into #256 | Exact Node 24 mainline CI passed; #260 closed as superseded. UI-dependent browser/navigation deltas are tracked in #271 | Integrated; UI follow-up in #271 |
| Location timezone persistence | Ported from #261 into #256 branch; migration 82 | Persistence, FUX-57, and migration-order regressions passed; #261 closed as superseded, branch retained | Complete |
| Location-aware availability | Ported from #262 into #256 branch | Effective timezone, schedule drift, commitment-safe updates, UI notice, and regression wired into CI | Verify exact root run; close #262 as superseded after green |
| Appointment workspace navigation | Historical PR #258 | Closed as deferred; unique behavior retained in source branch | Port through focused issue #271 on current `main` |
| Inline appointment operator forms | Historical PR #259 | Closed as deferred; unique behavior retained in source branch | Port through focused issue #271 on current `main` |
| Restaurant Recipe foundation | PR #269 | Separate feature; earlier CI failures were in inherited service/baseline journeys and need fresh exact-base diagnosis | Retarget to the integration root after it stabilizes; rerun exact Node 24 CI |
| Settings UX | PR #223 | Candidate consolidates #220–#222 features | Validate exact head, then merge once the mainline integration is stable; close #220–#222 as superseded |
| First Experience | PR #214 | Broad first-experience bundle; CI evidence exists but base is stale | Reconcile changed files and retest against updated main |
| Service audit documents | PRs #225 and #227 | Historical snapshots; parts are superseded by SC-03 implementation | Update evidence/status before merging; do not merge stale claims |
| Earlier SC-03/Telegram branches | Historical PRs #237 and #242 | Closed as deferred; both branches retained as audit sources | Audit/extract unique deltas through issue #272; never merge either branch wholesale |
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

**Mainline integration completed:** PR #256 was merged into `main` at `642f4e8c4da22dfafb12f75a0d099ca50b871c33`. The exact pre-merge code SHA `56bf4e02115e455bed7938679f0183682c476bf0` passed Sellify CI run `44564861229` and Repository Security Checks `44564861185`. The merge commit then passed:
- Sellify CI run `44565612432` — all four jobs successful: Node 24 baseline, Phase 13.10.24, Logistics L18, Logistics exit certification.
- Repository Security Checks `44565612363` — success.
- Logistics Runtime Certification `44565612614` — success.
- Sellify Release Certification `44565612378` — success.

The exact baseline included Inventory FUX-46–FUX-52, replay/auth/batch HTTP and runtime regressions, Phase 10.5, service booking persistence and on-site location scope, migration 80/81 compatibility, migration 82 location timezone persistence, and location-aware availability timezone regressions.

**Deferred work:** #258/#259 were closed and moved to issue #271 for a focused appointment workspace/inline-form port onto current main. #237/#242 were closed and moved to issue #272 for historical branch delta extraction. Their source branches are retained as audit references. The current open implementation PRs are #269 (Restaurant Recipe), #223 (Settings UX), #214 (First Experience), #217 (UI evaluation environment), plus audit/documentation PRs #225, #227, and #189.

Node >=24 remains mandatory. These successful gates validate the integrated SC-03/Inventory mainline slice; they do not certify deferred appointment UI or unrelated platform work.
