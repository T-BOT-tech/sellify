# Sellify — Next Implementation Plan: First Experience and Global Commerce

**Prepared:** 27 October 2026 (UTC+03:00)  
**Repository:** `T-BOT-tech/sellify`  
**Planning baseline:** `main` at `17ba6d6262ed2805cc432a2cdf2d884a8e47c010`  
**Purpose:** Define the next evidence-based implementation sequence after the currently active work, without duplicating open PRs or introducing parallel authorities.

> **Source and confidence note:** At this baseline, the repository contains implementation handoffs, contracts, regressions, and open PR descriptions, but no separately tracked authoritative document named “First Experience” or “Global Commerce OS.” This plan is therefore a repository-grounded continuation plan, not a claim of complete line-by-line coverage against an unavailable external specification. Reconcile it with the original product document if that document is reintroduced into the repo.

## Recommendation in one sentence

Do not start another onboarding feature or country pack yet. First stabilize the active outbox follow-on PR with its current CI failure, then coordinate the overlapping First Experience PRs on their live heads and prove their combined behavior in one current-base integration journey; only after that integration gate passes should the next narrow product implementation be selected from actual uncovered acceptance criteria.

## Live coordination snapshot

The following was observed through GitHub on 27 October 2026, around 20:28 UTC+03:00. These are mutable remote facts, not permanent claims; refresh them before acting.

| PR | Current purpose | Observed state / checks | Planning consequence |
|---|---|---|---|
| [#84](https://github.com/T-BOT-tech/sellify/pull/84) | Merchant business templates; first physical product or service | Open draft; checks passing | Core onboarding proposal, but does not implement hotel/rental capacity or appointments. |
| [#85](https://github.com/T-BOT-tech/sellify/pull/85) | Persist template in tenant-owned server storage | Open draft; checks passing; based on an older PR #84 SHA | Restack/rebase before treating the persistence behavior as current-base integration. Behavioral cart-restore coverage is required after rebasing. |
| [#87](https://github.com/T-BOT-tech/sellify/pull/87) | First Experience entry/readiness, Marketplace discovery, Home, Pack readiness, ecosystem discovery | Open draft; checks passing | Broad overlapping UX branch; coordinate rather than copy into another branch. |
| [#89](https://github.com/T-BOT-tech/sellify/pull/89) | Country-pack-aware onboarding, 13-language preference, country/currency separation | Open draft; checks passing | Overlaps onboarding routes and tenant/server code. Preserve language/country/currency distinctions and no implied provider readiness. |
| [#90](https://github.com/T-BOT-tech/sellify/pull/90) | Browser-safe module serving and boot fixes | Open draft; checks passing | Existing home for module-resolution fixes; do not duplicate. |
| [#86], [#91–#98] | Outbox recovery, concurrency, and browser verification chain | Open, stacked PRs | Keep the chain isolated from First Experience changes. PR #98’s observed head was `6e1d56b…` and its baseline Node 24 check was failing; fix/understand that failure in its own PR chain before treating that work as complete. |

PR #84, #85, #87, and #89 have concrete file overlap. PR #84 and #87 both change `app/index.html`, `backend/lib/store-sqlite.js`, and `backend/server.js`; PR #84 and #89 both change `app/index.html`, `app/src/auth/tenant.js`, `backend/lib/store-sqlite.js`, `backend/server.js`, and CI/package wiring; PR #87 and #89 both change `app/index.html`, `backend/server.js`, and CI. The exact `gh pr diff --name-only` path lists should be refreshed before any restack. A green check on each PR independently is not evidence that the combined behavior passes.

## Stage 0 — Close the active verification blocker, without scope mixing

**Objective:** Make sure the already-submitted offline recovery work remains reviewable and technically coherent before using its completion as a prerequisite for additional work.

1. Refresh PR #98 and its base chain (PR #97 and preceding outbox PRs). Inspect the failing check at the exact current head; do not infer the cause from a prior local commit because the remote head changed after the earlier local validation.
2. Reproduce the failing baseline check under Node 24 from the exact PR head. If it is a code defect, fix only in the outbox branch chain and rerun the helper, recovery, browser, and CI regressions. If it is an environment/baseline problem, capture the exact error and identify the owner of that baseline rather than weakening the test.
3. Confirm the fallback PR remains based on the latest intended PR #97 head and that its outbox-only file set does not contain First Experience or country-pack changes.
4. Do not merge, close, or retarget the PR chain as part of this plan. Merge authority stays with the user.

**Exit:** Current PR #98 head is known; all required CI checks are green or any remaining external block is explicitly documented; its reviewed diff remains isolated from onboarding work.

## Stage 1 — Build a current-base First Experience integration candidate

**Objective:** Verify the combined onboarding journey on a disposable branch based on current `main` and current PR heads, then submit only the resulting missing, non-duplicative changes.

### 1A. Establish the integration order

1. Refresh all PR heads, base SHAs, review state, checks, and changed paths. Record a table of changed files and overlapping hunks.
2. Treat PR #84 as the business-template/first-catalog-item base only if its live head still represents the approved direction.
3. Restack PR #85 onto the **current PR #84 head**, not merely a branch name or historical base SHA. Re-run PR #85’s authenticated HTTP persistence regression and the A→B→A tenant cart/template behavior. Do not assume a successful template GET/PUT test proves tenant cart restoration.
4. Compare PR #87 with the current PR #84/#85 implementation. Integrate only non-overlapping user-facing readiness/discovery behavior that is absent after the business setup flow is current. Preserve existing permission, Pack readiness, Marketplace, and Telegram security authorities.
5. Compare PR #89 with the resulting onboarding tree. Resolve its edits to `app/index.html`, tenant creation, backend routes/store, and CI as a coordinated integration; do not cherry-pick duplicate copies of shared files.
6. Keep the integration candidate local and disposable until its test suite passes. This is a behavioral baseline, not authorization to merge or rewrite open PRs.

### 1B. Run the combined behavioral acceptance matrix

Run against Node 24 and a real browser; use controlled fixtures, real app modules, and reloads. Stub only external identity/payment services where necessary and state every stub.

| Journey / invariant | Required observable result |
|---|---|
| New merchant entry | Visitor can discover supported workflows without receiving authenticated or tenant-scoped data. Pairing/auth boundaries remain fail-closed. |
| Returning merchant | Existing authenticated merchant routes to the correct workspace; setup is not silently restarted or assigned to another business. |
| Template selection | Selected template is validated and persisted to the server-owned tenant record; unknown keys and client-supplied capability claims are rejected. |
| First catalog item | Product remains stock-tracked by existing rules; service item persists as canonical `item_type: service` and does not receive physical stock fields or inventory consequences. |
| Tenant isolation | Tenant A→B clears A’s transient data from B; B→A restores A’s scoped cart/template/notes as designed after reload; B’s data remains independent. Cross-tenant reads/writes fail closed. |
| Country choice | Only supported active packs are selectable; unknown, candidate-only, regional-only, or empty country is rejected before tenant persistence. Country validation does not implicitly enable tax, payment, or compliance behavior. |
| Language choice | Existing 13-language catalog is available; saved preference is preserved or falls back to the documented default. Language is not inferred from country or sent as jurisdiction. |
| Currency | Blank currency may default from the selected active pack; an explicit valid currency choice is preserved. Currency remains its own money authority and is not implied by UI language. |
| Marketplace/Pack/channel | Purchasable listing, capability metadata, Pack setup/readiness, channel connection, seller registration, and workspace state remain distinct; read-only discovery does not mutate activation or registration. |
| Home readiness | Connectivity alone does not mean business readiness. Readiness is operation-specific; inventory exceptions are non-applicable when there are no stock-tracked products. |
| Browser boot | Module requests load in documented full-backend and frontend-only modes without unsafe backend-tree exposure, script 4xxs, or console/page errors. |

Use existing regressions first, including `phase0/first-experience-service-catalog-frontend-sync-regression.mjs`, `phase0/first-experience-service-catalog-http-regression.mjs`, country-pack onboarding tests from PR #89, PR #87’s dedicated first-experience tests, and PR #90’s browser-serving tests. Add one compact integration-level regression only for a real gap not covered by existing tests; do not duplicate every component test in a monolithic script.

### 1C. Produce an evidence-based gap ledger

For every acceptance row, label the result **PASS**, **FAIL**, **NOT TESTED**, or **BLOCKED**, with source file, command, runtime/browser, and evidence artifact. Do not describe a feature as “remaining” solely because an older planning document says so; inspect current source and tests first. If all rows pass, the next code task must come from a different, concrete uncovered project requirement—not from speculative feature expansion.

**Stage 1 exit:** Current-base integration test candidate is clean; each changed PR’s behavior is either represented in the combined matrix or explicitly deferred; any new patch is limited to a demonstrated gap. The user reviews/merges PRs.

## Stage 2 — Select one next implementation slice by evidence

After Stage 1, choose only one item in this order:

1. **Onboarding failure/recovery UX**, if the integration matrix finds real failure paths with no clear retry or safe recovery. Cover stale sessions, country/template validation errors, server timeouts, and idempotent retries; keep the server authoritative.
2. **First-workspace activation clarity**, if users can complete setup but cannot distinguish setup completion from actual operational capability. Present existing readiness evidence and next actions; do not manufacture “ready” from configuration alone.
3. **Focused operator usability** (accessibility, empty/error state, localization correctness), but only where a measured browser/accessibility regression exposes a gap.
4. **Country overlays or provider enablement** only after a market has passed separate evidence gates for legal/tax, money/currency, provider support, security, operations, and support. A locale or language choice alone is never a launch/readiness gate.

For the chosen slice: name the canonical authority, preserve the API/data boundary, add a focused regression and CI registration, test the exact journey under Node 24, then submit one narrow PR. No universal onboarding engine, country registry, provider switch, or parallel commerce authority.

## Non-negotiable product and architecture invariants

- **Language ≠ country ≠ currency ≠ legal jurisdiction ≠ payment/provider readiness.** A French-speaking merchant may select French UI while operating under a different country and currency. Arabic or Portuguese support is not proof of any country’s tax/provider launch readiness.
- Localization/i18n is global platform capability. Country packs provide declarative country-specific defaults and references; they do not own translations or imply a legal jurisdiction from language.
- Country and regional packs remain composition/configuration, not orders, inventory, payments, identity, authorization, audit, events, or persistence authorities.
- Template choice communicates setup intent only. A label such as hotel, rental, salon, or repair must not promise reservation capacity, deposits, appointment execution, or industry-specific processing absent canonical backend capability.
- Preserve the authority flow: UI intent → existing client/capability API → canonical backend authority → business operation → audit/evidence.
- Preserve tenant scoping, role/resource authorization, idempotency, concurrency, and audit invariants in server-side enforcement.

## How to resume

Start by refreshing GitHub; capture current PR #98 CI failure and the latest #84/#85/#87/#89/#90 heads and paths. Then execute Stage 0 and Stage 1. Do not repeat planning if the source and PR state have not materially changed. Do not merge or close any PR without explicit user authorization.
