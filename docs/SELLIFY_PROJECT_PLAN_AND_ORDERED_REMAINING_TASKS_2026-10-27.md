# Sellify — Project Plan and Ordered Remaining Tasks

**Prepared:** 27 October 2026 (UTC+03:00)  
**Repository:** `T-BOT-tech/sellify`  
**Planning baseline:** `main` at `17ba6d6262ed2805cc432a2cdf2d884a8e47c010`  
**Purpose:** Provide an ordered, dependency-aware backlog for First Experience, Global Commerce foundations, and project-wide readiness. This is a status snapshot, not an assertion that open PRs are merged.

## Reading this plan

- **Implemented in source** means the cited code/contracts/tests are present on the inspected baseline or an explicitly cited open PR; it does not mean the code is merged or production-certified.
- **Open PR** is reviewable work only. It is not a completed release item.
- **Verified** means a stated local or GitHub check passed on a specific SHA/runtime. It does not automatically certify a combined flow.
- **Unverified integration** means independently passing branches have not yet been proven together on one current-base journey.
- **Deferred** means do not implement now unless a dependency or evidence gate changes.

The repository snapshot did not contain a standalone First Experience or Global Commerce OS product specification. This document derives its ordering from current source, tests, project handoffs, and live PR metadata. Compare it against the original product specification when that document is available.

## At-a-glance current state

| Area | Snapshot status | Evidence / caution |
|---|---|---|
| First Experience entry/readiness | PR #87 open draft; checks passed | Covers Marketplace discovery, returning merchant routing, Add permissions, operation-specific Home readiness, Pack lifecycle evidence, ecosystem discovery, and Telegram capability alignment. It overlaps merchant onboarding. |
| Business templates / first product or service | PR #84 open draft; checks passed | Template and first catalog item flow. It does not create hotel/rental capacity or appointment execution. |
| Tenant-persisted business template | PR #85 open draft; checks passed | Stacked on a stale PR #84 base SHA (`44a339399ea76ea8dbb076dd6dfb018148a31673` in prior live inspection); restack and behavioral verification on current PR #84 head before merge. |
| Country-pack onboarding / 13-language preference | PR #89 open draft; checks passed | Active country choices, saved/default language selection, currency defaults, fail-closed country validation. Does not enable a provider or tax/compliance capability. |
| Browser module serving | PR #90 open draft; checks passed | Allowlisted browser-safe module delivery, frontend-only dev server, boot fixes and regressions. Do not duplicate this work. |
| Offline outbox | PR #86 with stacked PRs #91–#98 open | Current PR #98 head seen as `6e1d56b6a1fe79bcf72102539315dfda061f10e7`; its Node 24 baseline check was failing at snapshot time. Separate local browser/helper results from remote CI state. |
| Language/country/currency architecture | Existing i18n, country pack, country configuration, and money authorities | Preserve explicit independence; country pack and regional contracts are declarative/persistence-neutral. |
| Regional expansion contract | Phase 15.4 strategy and Phase 15.5 EAC regional contract are documented as implemented | Phase 15.6 country priority/sequencing gate precedes additional country rollout in the existing strategy. Contract implementation is not legal/provider launch readiness. |
| Service commerce | Existing catalog/service-booking/payment/fulfillment boundaries and regressions | Older handoff documents may carry stale “remaining” lists; refresh actual routes/tests before choosing a new service task. |
| Release and regression inventory | In progress as a cross-cutting readiness task | The inherited verification context identified baseline hash mismatches in Phase 13.12.3, 21.17, and 22.0. Recheck those against live source and CI before labeling them unresolved. |

**Snapshot time:** GitHub state and checks were refreshed on 27 October 2026 around 20:28 UTC+03:00. Heads and check outcomes can change; refresh before execution. PRs #84, #85, #87, and #89 showed passing checks, but their integration remains unverified. PR #98 showed one failing baseline check and one passing logistics check. No merge state is inferred from those results.

## Ordered plan

### 0. Keep active PR chains healthy and non-duplicative

**Priority:** P0 / first operational gate.  
**Owners:** Existing PR authors/reviewers; coordinate rather than replace their work.

1. **PR #98 / outbox chain:** Inspect the current failing baseline check at its current SHA. Reproduce with Node 24, then fix in the existing outbox follow-on branch or document an external CI issue. Confirm PR #98 still targets PR #97’s intended head and compare its current changed paths. Preserve PR #86 and #91–#97 stack order. Do not transplant older local recovery versions over newer remote changes.
2. **PR #90 / browser module resolution:** Keep all allowlist serving and boot/module fixes in PR #90. Confirm its CI and browser runtime evidence when the combined onboarding candidate is run. Do not open a second PR for those same source paths.
3. **PR #84/#85/#87/#89 / onboarding:** Refresh branch heads and perform the integration sequence in the companion [next implementation plan](SELLIFY_NEXT_IMPLEMENTATION_PLAN_FIRST_EXPERIENCE_GLOBAL_COMMERCE_2026-10-27.md). Resolve the PR #85 stale base. Coordinate shared files, especially `app/index.html`, `app/src/auth/tenant.js`, `backend/lib/store-sqlite.js`, `backend/server.js`, `.github/workflows/ci.yml`, and `package.json`.
4. Keep review/merge decisions with the user. No PR is considered complete because it was pushed, green independently, or described as ready in a prior handoff.

**Exit evidence:** Current SHA/branch graph; exact red-check cause resolved or documented; no duplicated file changes; reviewers can see a clear PR dependency order.

### 1. Certify combined First Experience onboarding before adding another feature

**Priority:** P0 / user-facing journey.  
**Depends on:** Stage 0 branch coordination and current PR heads.

Run one current-base, real-browser integration suite with reloads and at least two tenants. Cover:

1. New visitor discovery and safe transition into pairing/authentication.
2. Returning-merchant routing without resetting identity or setup.
3. Business template persistence to the correct tenant; reject unknown templates and caller-invented capability claims.
4. First catalog item behavior for both product and service; services must remain non-stock-tracked.
5. Tenant A→B→A cart/notes/template restoration and no cross-tenant leakage; include reload and independent durable-snapshot checks.
6. Country selection limited to active, supported packs and rejected before persistence when unknown, regional-only, candidate-only, or blank.
7. Selection/preservation of the existing 13 interface languages, with documented default fallback; language is not derived from country, sent as legal jurisdiction, or used to imply provider readiness.
8. Country-default currency only when appropriate; preserve explicit currency choice and keep currency distinct from language and jurisdiction.
9. Pack readiness and ecosystem panel are projections; no accidental activation, seller registration, channel connection, tax/payment readiness, or workspace mutation from viewing discovery.
10. Operation-specific Home readiness, permission-aware Add actions, and no inventory exception for zero stock-tracked items.
11. Full-backend and frontend-only browser startup using the PR #90 allowlists, with no unsafe static backend exposure or script-load/browser errors.

For each row record `PASS`, `FAIL`, `NOT TESTED`, or `BLOCKED`, plus source/test command, Node/browser version, and artifact. Add only missing, evidence-backed tests. Keep regressions modular and avoid a second onboarding authority.

**Exit evidence:** Combined suite passes under Node >=24 and Chromium; every PR’s diff is represented once; known non-goals are visible in UX and docs; current PR checks pass. User reviews and merges.

### 2. Fix only demonstrated onboarding gap(s)

**Priority:** P1 / implement after Stage 1 finds an actual failure.

Likely candidates, in order of evidence rather than assumption:

1. Retry/recovery for tenant creation, template save, country validation, or intermittent server failure, using existing idempotency and error conventions.
2. Clear distinction between “setup saved,” “capability available,” and “business is ready to operate.” Use existing readiness evidence; do not equate connection status with business readiness.
3. Accessible keyboard/focus/announcement behavior and localized text in the actual onboarding path, if automated accessibility or user-flow evidence exposes a gap.
4. Improve empty/error states for first product/service creation, retaining canonical product/service identity and current inventory rules.

For each small patch, identify the authoritative API/store, server-side scope and permission, idempotency contract, failure mode, tests, and CI gate. Do not bundle unrelated country rollout, payment, or offline changes.

### 3. Reconcile durable tenant/template and cart isolation

**Priority:** P1 / cross-cutting reliability.  
**Depends on:** Current PR #84/#85 integration base.

- Rebase/restack PR #85 onto the live PR #84 head, not a historical SHA.
- Preserve template write ownership (server-owned tenant record, owner authorization, allowed template values, audit event); reject capability claims from the client.
- Re-run authenticated HTTP unauthorized/owner/invalid-template/persistence cases.
- Re-run browser A→B→A cart, note, catalog/customer, and template behavior after reload. Assert marketplace cart or tender/session-only state does not leak or persist if the contract says it is ephemeral.
- Verify failure and conflict behavior: tenant mismatch, stale update, duplicate request, and same idempotency key with changed body where applicable.

Do not turn template persistence into a second tenant identity, catalog, order, or capability authority.

### 4. Maintain offline durability, browser entry points, and tenant-safe recovery

**Priority:** P1 engineering/release gate; isolated PR family.

- Resolve current red check(s) in the outbox chain and preserve stack ordering.
- Verify IDB transaction abort, localStorage journal write failure, journal marker/recovery lineage, Web Lock serialization, no-lock append log, stale in-flight completion, tombstones, and cold-start recovery under Node 24 and real-browser multi-tab tests.
- Confirm tests cover localStorage quota/storage denial as a best-effort failure, and do not claim durability when both persistent paths reject writes.
- Audit tenant binding of pending commands/events during account switching; never silently reassign unscoped or foreign-tenant work.
- Keep browser module serving changes in PR #90, with a strict allowlist and path traversal protection; run the same module graph in documented full and frontend-only modes.
- Separate source tests, local browser tests, and GitHub CI status in reports. The inherited session identified pre-existing hash mismatches at Phase 13.12.3, 21.17, and 22.0; refresh exact scripts/source and current CI before correcting them. Do not “fix” hashes by regenerating expected values without understanding the artifact contract.

**Exit evidence:** Green required Node 24/security checks at exact commit; runtime browser tests use actual source and state the external stubs; failure behavior is explicit; no outbox changes are mixed into onboarding PRs.

### 5. Complete payment, service, fulfillment, and seller-operation slices through existing authorities

**Priority:** P1/P2 / product operations.  
**Depends on:** Current service/payment/fulfillment source review; older roadmap is historical context, not proof of a gap.

1. Refresh [service-commerce continuation handoff](SELLIFY_SERVICE_COMMERCE_CONTINUATION_HANDOFF_2026-10-20.md), live `main`, APIs, tests, migrations, and open PRs before choosing the task. Do not reuse its dated CI/head facts as current.
2. Close only verified HTTP-level holes in service-booking scope, failure/rejection, idempotency conflict/replay, authorization, and server-authored evidence. Preserve booking ≠ order/payment/inventory/fulfillment authority.
3. For payment, use Payment Core, provider adapters, existing account and evidence boundaries; do not create a frontend ledger or direct provider-to-database write.
4. For logistics, preserve the canonical fulfillment/assignment authority and tenant/location authorization. Do not auto-create a scheduling activity for every service appointment.
5. For seller storefront/channel, compliance/audit, IAM, and dispatch UX, use the existing roadmap’s partial-work items only after source review. Avoid parallel authorities and broad rewrites.

**Exit evidence:** A narrow HTTP/browser regression, authorization/idempotency/audit evidence, existing route reuse, and CI registration for the chosen domain only.

### 6. Advance Global Commerce with evidence gates, not country-count targets

**Priority:** P2 / strategic; not a near-term onboarding shortcut.  
**Already present:** Phase 14 country pack/configuration contracts, Phase 15.1 contract hardening, Phase 15.4 strategy, and Phase 15.5 declarative EAC regional contract are documented in the repository.

Ordered sequence from current architecture:

1. **Phase 15.6 — country priority and sequencing gate.** Confirm whether its implementation/artifact exists on current `main` (do not trust filenames alone). Use the documented weighted evidence dimensions—market, currency reuse, language reuse, regulatory/tax, trade integration, payment ecosystem, implementation complexity—plus legal, security, operations, support, and provider readiness. Produce a reasoned decision record, not an automatic launch trigger.
2. **Regional contract verification.** Validate current EAC membership/source references and country overlays. The Phase 15.5 contract says EAC uses country currencies, not an invented regional currency; regional language signals are not identical country language requirements.
3. **One country overlay only after a decision gate.** Gather current source-backed country tax/document/phone/address/payment/compliance requirements. Keep every field’s status explicit (`contract_only`, `candidate`, `implemented`, `verified`, `production-ready` as locally defined); never promote a provider name in metadata to an active integration.
4. **Regional extensions in the documented order** (WAEMU, CEMAC, other strategic markets, cross-region integration) only after the priority and country overlays prove reusable contracts without duplicate authorities.
5. **Cross-country tests and release certification.** Test pack compatibility, tenant isolation, language independence, country-specific currency/money correctness, no provider side effects, and Node >=24.

**Deferred:** Additional country activation, tax engines/rates, invoicing, provider credentials/integration, and legal/compliance assertions without current jurisdiction-specific evidence and explicit product approval.

### 7. Final release certification and project documentation maintenance

**Priority:** P2 / required before broad rollout.

- Reconcile actual test inventory with `package.json` and CI; identify focused tests absent from CI and any stale duplicate tests.
- Run the supported Node >=24 regression, security, migration, browser smoke, and release gates against an exact SHA.
- Check migrations, backup/rollback, tenant isolation, authorization, accessibility/localization, error reporting, and operational recovery.
- Record known limitations separately from passing checks and keep their owners/actions visible.
- Update the dated status snapshot only after live verification; never let this file override source or live GitHub data.

## Deferred or forbidden until prerequisites are met

- Rewriting First Experience or country logic while PR #84/#85/#87/#89 remain uncoordinated.
- Adding new language/country/payment features because their labels appear in a template.
- Activating a country or provider from language choice or a country-pack declaration alone.
- Promising appointment, hotel, rental, deposit, or industry-specific execution without a canonical API and durable state authority.
- Creating a universal commerce/workflow engine, regional payment/inventory ledger, or parallel tenant/country persistence registry.
- Treating standalone passing PR checks as combined integration proof.
- Merging/closing PRs or altering user-owned PR review/branch policy without permission.

## Suggested execution calendar (dependency order, not dates)

| Sequence | Deliverable | Can proceed in parallel? | Stop condition |
|---:|---|---|---|
| 0 | Refresh/repair active PR #98 check and verify outbox chain | Only within outbox owners | Current head/check not understood or branch changes during validation |
| 1 | PR overlap map and PR #85 restack plan | Yes, read-only coordination | Exact head/base/path inventory missing |
| 2 | Disposable combined First Experience candidate | No; requires compatible current PR heads | Any unresolved merge conflict or unauthorized scope change |
| 3 | Cross-tenant/country/language/browser integration matrix | No; run against candidate | Any tenant leak, implied capability, or failing journey |
| 4 | One evidence-backed onboarding fix or declare no gap | No; follows test findings | No reproduced gap or unclear owning authority |
| 5 | Domain-specific service/payment/fulfillment refinement | Narrow independent units after review | Authority, permission, or idempotency contract unresolved |
| 6 | Phase 15.6 country priority and one evidence-backed overlay | Strategy may start read-only; implementation waits on evidence | Legal/provider/operational facts not sourced or approvals absent |
| 7 | Full Node 24, security, migration, runtime, release certification | May begin preparation earlier; final run after merges | Exact release SHA or rollback/evidence missing |

## Status refresh checklist for the next session

Before executing any row, fetch `main`; refresh PRs #84, #85, #86–#98 and any newer related PR; record their exact heads/base SHAs, open/draft state, changed files, checks, and merge conflicts. Compare the local implementation worktrees and remote paths so another contributor’s new work is neither overwritten nor duplicated. Run commands on the intended exact head, then update this snapshot only if evidence changes.
