# Sellify — Next Implementation Plan: First Experience and Global Commerce

**Revised:** 29 October 2026 (UTC+03:00)  
**Repository:** `T-BOT-tech/sellify`  
**Documentation PR:** #99 — `docs/first-experience-global-commerce-plans-20261027`  
**Last inspected documentation-PR head:** `486dd83f8a2ec335dcce648847bd3e9594983968`  
**Purpose:** An evidence-led continuation plan based on current GitHub metadata and repository implementation history. This is a plan, not a claim that every feature is merged, certified, or production-ready.

> **Important source boundary:** The live repository evidence available for this update shows that multiple formerly active PRs were closed without being merged. Their branches and passing historical checks do not establish that their code is on `main`. Before implementation, compare the exact current `main` source against the relevant PR diffs and tests. A closed, unmerged PR is neither a completed feature nor automatically a reason to reopen the same work.

## 1. Current recommendation

**Do not start another broad First Experience feature, country pack, or new abstraction yet.** First establish what is actually present on current `main`; review the two current-main payment UX fixes (#153 and #158) against their exact heads and CI; then decide from concrete gaps whether outbox recovery, browser module serving, or onboarding integration needs to be reintroduced as a narrow PR. Only after this source-and-runtime gate should another product slice be selected.

This revises the 27 October sequence: PRs #84–#98 listed as active then are now reported **closed and unmerged** by the live GitHub connector snapshot on 29 October. Do not treat those changes as merged. Do not reopen, cherry-pick, or recreate them wholesale without proving that a required behavior is absent from current `main`.

## 2. Live GitHub coordination snapshot (29 October 2026)

This snapshot is a point-in-time report, not a substitute for refreshing status immediately before execution.

| PR | Latest observed status | What it means for implementation |
|---|---|---|
| #99 — this documentation PR | Open, unmerged; head `486dd83f8a2ec335dcce648847bd3e9594983968`; base `main` at `17ba6d6262ed2805cc432a2cdf2d884a8e47c010` in its metadata | Documentation branch is stale relative to the newer 29 October source/PR activity; update its documents, but do not merge without user authorization. |
| #153 — hide stale payment state in order queue | Open, unmerged; head `a11cb59337f4f0a88542f4ba41af569a28a122ac`; base `main` | Current-main focused payment-truth fix. Inspect current checks and regression; cached per-payment state must not be displayed as canonical when canonical order-payment summary refresh fails. |
| #158 — checkout save vs payment confirmation | Open, unmerged; head `c2af54f86677680a1a752d539b4b92a78dcb4a21`; base `main` | Current-main checkout/payment boundary fix. Inspect current checks and overlap with #153; keep order creation, receipt evidence, and canonical payment confirmation distinct. |
| #84 — merchant templates / first product or service | Closed, unmerged; head `efcf503016e84e3bed800ad5c32187758b163156` | Historical candidate only. Inspect `main` for the desired template and first-item behavior before deciding whether any narrow part remains. |
| #85 — persist business template in tenant storage | Closed, unmerged; head `1771fb33e9c5747e7a426bd2fac5eccf932f36fa`; was stacked on #84's branch | Historical candidate only. Never assume tenant persistence or A→B→A cart restoration landed. Verify server code and runtime behavior directly. |
| #87 — First Experience entry/readiness | Closed, unmerged; head `f467d71023c5880467ddf9e6db10c138ba334a91` | Historical candidate only. Inspect current entry routing, permissions, Home readiness, Marketplace discovery, and Telegram alignment. Do not copy the broad branch without gap evidence. |
| #89 — active country packs and language/currency onboarding | Closed, unmerged; head `cae982c98935671bf68441fde4491ec964131650` | Historical candidate only. Verify current country choices and validation, 13-language preference, currency defaults, and no implied provider activation. |
| #90 — browser-safe module serving | Closed, unmerged; head `3bb08d404759a774ffcc4123fdf2a95c88c320ab` | Historical candidate only. Reproduce the full-app browser module graph and check the actual serving allowlist in current `main`; do not expose the backend source tree as a workaround. |
| #86 and #91–#98 — outbox recovery/serialization/browser chain | All reported closed, unmerged. #98 head `440af94be7ad17c420d35a707dc9d6b7607f7016`; #97 head `249b8a7f96ec6c3b881ae2d37ff25d680b1093ae`; #86 head `3483d5ffea2bb411e8f66c1c6677fe82a47e4c83` | Historical chain only. Do not assume the recovery fixes are on `main`; inspect current outbox/IDB source and run targeted tests before deciding whether to revive or replace any slice. |
| Other older open PRs | Current search still surfaced PRs such as #50, #52, #61, #62, #71–#74; statuses and dependencies must be refreshed individually | Do not infer merge readiness or current relevance from old PR descriptions. Reconcile with current source, test evidence, and dependency graph. |

**Status semantics:** “Closed, unmerged” means the PR did not merge according to the returned metadata. It does not prove the work was discarded, reverted, or absent from another branch. Only comparison against current `main` resolves that question. Historical check results remain tied to their tested SHAs.

## 3. Stage 0 — Re-establish the real implementation baseline

This is the immediate first task. Do not start by restacking all historical branches.

1. Fetch the current `main` SHA and working tree state. Record the exact commit used for all following inspection.
2. Refresh open PR #153, #158, and #99: head SHA, base SHA, changed paths, reviews, checks, and latest commit. Retrieve check/job details rather than relying on PR-body claims.
3. Compare current `main` with the closed/unmerged branches that could affect the next user journey: #84/#85/#87/#89 (onboarding), #90 (browser serving), and #86/#91–#98 (outbox). Use targeted diffs and source/test inspection; do not assume any of these landed.
4. Inspect the current `package.json`, `.github/workflows/ci.yml`, browser harness, relevant test scripts, and canonical runtime modules. Confirm which regressions still run in CI and whether they exercise actual runtime behavior or only source patterns.
5. Build a compact evidence ledger for each candidate behavior: **present and runtime-verified**, **present but only source-tested**, **missing**, **regressed**, **blocked**, or **not checked**. Include source path, command, runtime, SHA, and output.
6. Keep separate worktrees/branches for payment, outbox, browser serving, and onboarding. No broad cherry-pick or force-reset; do not merge or close any PR without explicit user authorization.

**Stage 0 exit:** One authoritative `main` SHA, an accurate PR graph, and a list of real missing/regressed behaviors supported by current evidence.

## 4. Stage 1 — Resolve the current-main payment UX boundary

Review #153 and #158 first because they are the most recently observed current-main user-facing fixes and share the payment-truth boundary. Do not presume their checks are green; refresh them at the current heads.

### 4A. PR #153: stale state suppression

Verify that:
- A canonical order-payment summary is the authority for order-level financial state.
- When refresh fails, the UI does not continue presenting cached `PAID`, `PARTIAL`, or `UNPAID` state as freshly confirmed truth.
- A per-payment cached row is not rendered as authoritative when the order-level summary is unavailable.
- The explicit checking/unavailable state is visible and does not fabricate a success.
- The regression runs under CI and covers the failed refresh path, not just a source-string match.

### 4B. PR #158: checkout evidence and save semantics

Verify that:
- Checkout clearly says it saves an order to the queue; choosing a payment method or attaching a receipt does not confirm payment.
- Missing/disabled payment methods fail safely rather than silently defaulting to cash.
- Receipt persistence failure leaves the user able to retry without silently saving an order that omitted selected evidence.
- Repeated activation during async receipt processing cannot create duplicate local orders.
- Canonical payment summary refresh is protected from late responses after cache invalidation or tenant changes.
- Payment adapter identifiers are normalized before projection upsert.
- Existing order/payment IDs and Payment Core authority remain canonical; no frontend ledger or new payment authority is introduced.

### 4C. Integration and exit gate

Run each focused regression and baseline/security workflow on the exact current PR heads, then test the combined checkout→queue→canonical summary path. Test refresh success, refresh failure, stale late response, no enabled payment method, receipt storage failure, repeated taps, local/unlinked order, and later canonical payment update. Keep order value, local order state, evidence attachment, and verified money received as separate concepts.

**Exit:** All required CI checks pass on exact heads, the combined journey is verified or its blocker is documented, and no stale or caller-reported state is presented as canonical. Merge remains a user decision.

## 5. Stage 2 — Reassess offline outbox recovery only from current source

The former #86–#98 branch chain is now closed/unmerged in the observed metadata. The known historical work included in-flight mutation protection, three-way event merge, deep snapshots, Web Locks serialization, a same-tab no-lock queue, IndexedDB-serialized journal writes, Chromium runtime regression, and localStorage-only append-log recovery. #98's last described change also covered atomically checkpointing fallback operation IDs with the outbox and commit marker, plus cleanup-failure recovery.

Those are historical implementation claims, not proof that current `main` contains them. Inspect the current files and tests before choosing a next action.

### Required reliability matrix

- Web Locks available: concurrent writes serialize the journal and IndexedDB commit marker.
- Web Locks unavailable: same-tab async persistence is queued; cross-tab writes do not race a shared snapshot replacement.
- IndexedDB transaction abort: no false commit marker; recovery records remain available; retry or cold-start hydration restores the event.
- IndexedDB unavailable/blocked: localStorage fallback is explicit and does not claim stronger durability than the storage guarantees.
- localStorage write/cleanup failure: valid older records are preserved; a cleanup failure cannot cause stale replay to overwrite a newer committed event.
- Delete/tombstone replay: older snapshots do not resurrect deleted events.
- Same-event concurrent edits: merge semantics are deterministic and documented; conflicting field behavior is tested.
- Stale in-flight completion: an older asynchronous result cannot overwrite a newer mutation.
- Tenant/account switch: pending events cannot be silently rebound to a different tenant.
- Cold-start/browser reload and two independent browser realms: recovery works using real modules and actual persistence transactions.

Use the existing regression scripts if present, validate that CI still runs them, and add only a missing high-value test. Do not rewrite expected hashes blindly; inspect the source/artifact contract first. Do not weaken the browser test to avoid a genuine regression. If the relevant behavior is absent, create a focused PR from current `main`, not a revival of a whole obsolete stack.

**Exit:** Required Node 24 and real Chromium/browser tests pass on the exact commit; persistence-denial behavior is accurately described; all failures are attributable; no onboarding or payment UX changes are mixed into the outbox patch.

## 6. Stage 3 — Reconstruct and certify First Experience only where it is missing

The historical PRs #84/#85/#87/#89 are closed/unmerged, so use them as evidence and source references—not as active implementation instructions.

### Integration acceptance matrix

| Journey | Required evidence |
|---|---|
| Visitor / new merchant | Discovery is available without exposing authenticated or tenant-scoped data; pairing/auth remains fail-closed. |
| Returning merchant | Correct workspace is restored; identity, tenant, and setup are not silently reset. |
| Business template | Only supported template keys are accepted; selection expresses setup intent, not unimplemented capabilities; tenant persistence is server-authoritative if required. |
| First catalog item | Product follows existing inventory rules; service remains canonical `item_type: service` and does not create physical stock/inventory consequences. |
| Tenant A→B→A | No cross-tenant leakage; durable cart/template/notes restore only where contractually intended, including after reload; ephemeral checkout/tender state stays ephemeral. |
| Country | Only supported active country packs can be selected; unknown, blank, candidate-only, or regional-only values fail before persistence. Country choice does not activate tax, payment, compliance, or providers. |
| Language | Existing 13-language support and preference/default behavior remain intact. Language is not inferred from country or used as legal jurisdiction. |
| Currency | Currency remains distinct from language and country identity; country-pack default applies only when appropriate and explicit valid selection is preserved. |
| Pack / Marketplace / channel | Discovery is read-only. Viewing a capability or pack does not grant permissions, activate a provider, register a seller, connect a channel, or establish operational readiness. |
| Home readiness | Connectivity is distinct from first-sale/operational readiness; readiness uses existing operation-specific evidence and permissions. |
| Telegram | Existing Telegram/PWA channel and storefront verification boundaries remain authoritative; a UI discovery action cannot bypass verification or publish state. |
| Browser boot | Full-backend and frontend-only modes load only approved browser-safe modules; no broad backend source exposure, script 404s, boot errors, or unhandled browser exceptions. |

### Integration method

1. Run the existing regressions first; confirm their script names in current `package.json` and CI.
2. Start from current `main`, not an old PR base.
3. Use historical PR diffs only to identify the smallest missing behavior.
4. Add one combined browser test only where individual component tests do not cover a real integration risk.
5. Test at least two tenants, reloads, failure/retry paths, and permission differences.
6. Label every result **PASS**, **FAIL**, **NOT TESTED**, or **BLOCKED** with SHA, command, Node/browser version, and artifact.
7. Submit a single narrow PR for a proven gap; do not copy all four closed branches into one mega-PR.

**Exit:** The first-use journey is verified on current `main`, and every proposed change is linked to a demonstrated gap.

## 7. Stage 4 — Global Commerce and country-ready architecture

Keep the agreed direction: **Global Core first; country-ready architecture from the beginning; country-by-country commercialization/localization after evidence.** Do not build Sellify as Ethiopia-only, and do not fully localize every market before commercial proof.

- **Language** is UI/content preference; the existing 13-language system is a global platform capability.
- **Operating country** selects an eligible country pack and its declared defaults; it is not derived from language.
- **Currency** is a separate money/configuration concern. Do not force currency into the first onboarding step unless the actual flow requires it; preserve explicit choices and define defaults in one canonical configuration path.
- **Country pack** is declarative composition for currency/localization defaults, tax/invoice references, country-specific validation, compliance requirements, payment compatibility, and local marketplace/logistics adapters. It must not become an independent order/payment/inventory/identity authority.
- **Provider adapter mapping is not provider activation or certification.** Manual payment and SMS-based payment verification should be evaluated against the existing Payment Core contracts; do not add provider count or a second Ethiopia implementation.
- **Regional/EAC strategy contracts** do not equal operational readiness for any member country. Use the existing country-priority/sequencing gate before rollout.
- **First Experience** should route visitors, prospective merchants, and returning merchants into existing workflows; it must not create a new capability registry, onboarding authority, payment core, or sync engine.
- **Channels** include Telegram and installable PWA, with POS/hardware treated as channels where supported. A channel is not a separate source of truth for commerce state.
- **Business templates/packs** (retail, services, restaurant, warehouse, logistics, B2B, marketplace, etc.) communicate a starting configuration; only existing canonical capabilities may be advertised as operational.

**Country-launch exit gate:** Country/legal scope reviewed; currency/money rules tested; provider contracts and certifications are explicit; country validation is enforced server-side; operational support/logistics path exists; localization is reviewed; security and audit regressions pass. No single language or country dropdown selection satisfies this gate.

## 8. Stage 5 — Existing-authority service, payments, fulfillment, and logistics

After the prior gates, inspect current routes, migrations, tests, and open PRs before declaring any service/logistics work remaining.

- Keep the chain **Marketplace Order → Seller Order(s) → Fulfillment(s) → Payment → Settlement → Delivery** consistent with canonical backend records.
- Service catalog identity is not proof that appointment capacity, booking execution, hotel/rental inventory, or industry-specific workflows exist.
- A booking/request, customer acceptance, assessment, assignment, delivery proof, and completion are distinct states with explicit authority and evidence.
- Payment selection, receipt image, reported cash tender, and order value are not verified payment. Payment Core remains the financial-state authority.
- Settlement reversal must wait for canonical refund confirmation where required; cancellation alone is not proof of funds returned.
- Logistics assessment/acceptance, courier assignment, delivery evidence, and inventory consequences must use the existing canonical lifecycle, tenant/location authorization, idempotency, and audit contracts.
- Avoid a second fulfillment lifecycle, parallel inventory/payment authority, universal workflow engine, or generic transport authority.

## 9. Reporting and change-control rules

For each implementation, report these separately:
1. **Source/static inspection**
2. **Focused local regression**
3. **Runtime/browser integration**
4. **Broader baseline/security suite**
5. **GitHub CI** with exact workflow/run and tested SHA
6. **Not verified / blocked**

Do not say “passed” without actual output. Do not infer current check state from an old PR description. Do not merge, close, or retarget PRs without explicit authorization. Keep unrelated work isolated and prefer one minimal evidence-backed fix plus one regression.

## 10. How to resume in the next chat

1. Refresh current `main` SHA and PR #99/#153/#158 status/checks.
2. Compare current `main` with closed/unmerged PR #84/#85/#87/#89/#90 and #86–#98 only where relevant.
3. Complete the #153/#158 payment UX review and combined journey.
4. Use the evidence ledger to decide whether outbox or browser serving has a real missing/regressed behavior.
5. Certify First Experience on current `main` only if a user journey remains uncovered.
6. Update the companion ordered-task document with evidence, not assumptions.
7. Keep merge decisions with the user.


## Superseding live implementation snapshot — 29 October 2026, 19:33 UTC

**Current `main` SHA at this snapshot:** `c4aa6bec2a420584185cd6509009c6696ff11fbc` (refresh before further work). This section supersedes earlier PR-state tables above where they conflict; the earlier tables remain historical context.

### Confirmed merges since the older snapshot

| PR | Result | Evidence / scope |
|---|---|---|
| #162 | Merged | Telegram storefront verification remains behind the canonical verification boundary. |
| #164 | Merged | Restaurant payment compatibility payload no longer invents canonical financial state. |
| #165 | Merged | Marketplace refund lifecycle reconciles through Payment Core; split-refund settlement remains held until all required refunds succeed. |
| #73 | Merged | Compliance UI prevents duplicate deletion-request submission while a request is pending; this is a UI guard, not server-side idempotency. |
| #74 | Merged | Contextual IAM role-revocation regression is included in CI. |
| #166 | Merged | Storefront channel status/configuration-version validation and regression are wired into CI. |
| #167 | Merged | Legacy `type: 'service'` is normalized to canonical `item_type: 'service'`; opening-balance inventory migration excludes both legacy and canonical service markers. Sellify CI, Repository Security Checks, baseline (24), logistics L18, logistics exit certification, and source-hygiene passed on PR head `6a2b1e1e31fc0aa5e345ca02d829e1b358ecaa8d`; merge commit is the current `main` SHA above. |

### Historical branches requiring no wholesale merge

| PR | Current status | Action |
|---|---|---|
| #50 service catalog / 13 locales | Open, conflicting | Reconcile individual behavior against current source; most service/catalog/localization work is already present. Do not merge the branch wholesale. |
| #51 service opening-balance guard | Open, mergeable | Its gap was addressed more completely by #167, including both aliases and regression coverage; treat as superseded unless a distinct missing behavior is demonstrated. |
| #52 marketplace settlement/refund | Open, conflicting | Superseded by merged #165; do not merge. |
| #72 storefront channel contract | Open, conflicting | Superseded by merged #166; do not merge. |
| #88 Telegram verification error precedence | Open, conflicting | Superseded by merged #162; do not merge. |
| #153 payment state in order queue | Closed, unmerged | Historical candidate only; inspect current source if the behavior is still relevant. |
| #158 checkout/payment confirmation clarity | Closed, unmerged | Historical candidate only; inspect current source if the behavior is still relevant. |
| #84, #85, #86, #87, #90, #94, #95, #98 | Closed, unmerged | Historical candidates only. Their old passing checks do not prove their code is in `main`; do not cherry-pick/reopen wholesale without a current-source gap and focused regression. |
| #99 this documentation PR | Open, unmerged at this snapshot | Update these docs with the current snapshot, then verify its current head and CI before considering merge. |

### Immediate implementation order

1. Continue current-source reconciliation of the remaining service-catalog PR #50; identify a specific uncovered behavior before changing code.
2. Review the First Experience/onboarding and Global Commerce documentation against actual current routes, canonical API contracts, and test evidence. Keep product discovery separate from permission/provider activation/readiness.
3. Revisit the closed outbox/browser-runtime PRs only when a reproducible current-main defect is established. Preserve the existing constraint: do not expose backend source through the browser as a smoke-test workaround.
4. Report source inspection, regression results, runtime/browser evidence, broader CI, and unverified behavior separately. Do not label static checks as runtime certification.


## Superseding implementation checkpoint — 30 October 2026

The earlier 29 October ordering is superseded by `docs/SELLIFY_LIVE_IMPLEMENTATION_STATUS_2026-10-30.md`.

**Inspected main:** `4d459ab890b86ebdc1235303325f66aa8e8be804`.

1. Do not continue treating #153/#158 as outstanding payment UX work. They are closed/unmerged historical branches; #159 and #160 merged the checkout/payment-state clarity and 13-locale copy, while #164/#165 strengthened payment authority/refund behavior.
2. Do not restart the old First Experience, browser-serving, or offline-outbox branch chains. The PR #188 candidate baseline passed the named service-catalog/business-template persistence, service-booking, outbox recovery/browser runtime, browser-module HTTP, production HTTP, and full-app Chromium smoke steps. The complete cross-component First Experience journey is still only partially certified.
3. Merged #168 and #170–#183 added/closed substantial merchant UX, service booking operator, legacy service identity, Warehouse, procurement, J5 low-stock, and diagnostics work.
4. Merged #184–#187 wired Phase 14, Phase 15, Phase 16, and Phase 19 cumulative/final certification gates into CI.
5. The only current open PR in the inspected recent-PR snapshot is #188. It adds Phase 20.12 to baseline CI but its current candidate failed at Phase 20.8 because the test fixture supplies unsupported provider-capability evidence source `carrier`; the contract permits `provider`, `adapter`, `network`, `manual`, or `sellify`. Security, Logistics L18, and Logistics L1–L21 exit certification passed on that candidate. Phase 20.9–20.11 were not reached.

**Immediate execution:** correct the Phase 20.8 fixture, rerun `npm run test:phase20.8`, `npm run test:phase20.12`, then verify all exact-head CI/security jobs on #188. Do not merge without authorization.

**After the blocker:** certify the integrated First Experience browser journey (new merchant → setup → first item → reload → tenant A/B/A → first sale → Home readiness), then collect deployment and country-launch evidence. Country pack tests do not by themselves prove a production country launch.

See the live status document for exact run IDs, candidate SHA, pass/fail boundaries, and the revised task ledger.
