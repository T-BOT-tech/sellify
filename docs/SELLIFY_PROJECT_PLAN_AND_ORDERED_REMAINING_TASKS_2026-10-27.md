# Sellify — Project Plan and Ordered Remaining Tasks

**Revised:** 29 October 2026 (UTC+03:00)  
**Repository:** `T-BOT-tech/sellify`  
**Documentation PR:** #99 — `docs/first-experience-global-commerce-plans-20261027`  
**Planning baseline in PR #99 metadata:** `main` at `17ba6d6262ed2805cc432a2cdf2d884a8e47c010` (27 October snapshot; refresh before execution).

> **Accuracy rule:** Several PRs treated as active in the 27 October snapshot now appear **closed and unmerged** in the 29 October GitHub snapshot. Do not infer that their code is on `main`, and do not assume it is absent: compare current source and tests. Old passing checks apply only to the exact historical SHA. This document is a repository-grounded plan, not proof of production readiness or complete coverage of an external product specification.

## 1. Status semantics

- **On current `main`:** source/tests exist at the exact inspected main SHA; runtime integration may still be unverified.
- **Source-tested:** static/source-contract regression passed; not proof of real browser or backend behavior.
- **Runtime-verified:** real modules and relevant API/storage paths were exercised under a named runtime/browser.
- **Open PR:** proposed work, not merged; refresh head, base, checks, and reviews.
- **Closed, unmerged PR:** no merge is reported. Compare its diff with current main before reviving any change.
- **PASS / FAIL / NOT TESTED / BLOCKED:** use explicit evidence. Missing evidence is never PASS.

## 2. Current remote snapshot (29 October 2026)

| Workstream | Observed state | Consequence |
|---|---|---|
| Documentation PR #99 | Open, unmerged; head `486dd83f8a2ec335dcce648847bd3e9594983968` at inspection | This documentation update remains reviewable; do not merge without user authorization. |
| Payment UX #153 | Open, unmerged; head `a11cb59337f4f0a88542f4ba41af569a28a122ac`, base `main` | Inspect current CI and the stale-payment-state regression. Cached per-payment state must not be presented as canonical when the canonical order-payment summary is unavailable. |
| Checkout/payment clarity #158 | Open, unmerged; head `c2af54f86677680a1a752d539b4b92a78dcb4a21`, base `main` | Inspect current CI and the combined checkout→queue journey: order save, enabled payment method, receipt persistence, duplicate taps, stale responses, identifier normalization. |
| Business templates #84 | Closed, unmerged; head `efcf503016e84e3bed800ad5c32187758b163156` | Historical candidate only; inspect current source before deciding what remains. |
| Tenant template persistence #85 | Closed, unmerged; head `1771fb33e9c5747e7a426bd2fac5eccf932f36fa` | Was stacked on #84. Do not assume server-owned persistence or A→B→A restoration landed. |
| First Experience #87 | Closed, unmerged; head `f467d71023c5880467ddf9e6db10c138ba334a91` | Inspect current entry routing, permission-aware actions, Home readiness, Marketplace/Pack discovery, and Telegram alignment. |
| Country-pack onboarding #89 | Closed, unmerged; head `cae982c98935671bf68441fde4491ec964131650` | Inspect current active-country validation, 13-language preference, currency defaults, and separation from provider activation. |
| Browser module serving #90 | Closed, unmerged; head `3bb08d404759a774ffcc4123fdf2a95c88c320ab` | Inspect current allowlist and real browser boot. Never expose the whole backend source tree as a workaround. |
| Offline outbox chain #86–#98 | Returned closed, unmerged. #86 head `3483d5ffea2bb411e8f66c1c6677fe82a47e4c83`; #97 head `249b8a7f96ec6c3b881ae2d37ff25d680b1093ae`; #98 head `440af94be7ad17c420d35a707dc9d6b7607f7016` | Historical chain included recovery journaling, serialization, browser tests, and localStorage-only fallback. None of this is presumed merged. Inspect current modules and run the reliability matrix. |
| Other older PRs | Search surfaced #50, #52, #61, #62, #71–#74 and others; not all were refreshed in this pass | Verify only when relevant to a demonstrated gap; do not batch-merge or repeat historical review. |

**Snapshot caveat:** PR metadata is mutable. Refresh every relevant head/check before execution. “Closed, unmerged” neither proves the work was discarded nor that another branch contains it; only comparison with current `main` answers that.

## 3. Ordered execution backlog

### P0 — Task 0: Establish current source truth

1. Fetch current `main` SHA and record it.
2. Refresh #153, #158, and #99 heads, base SHAs, changed paths, reviews, workflow runs, and job-level logs.
3. Compare current `main` against closed/unmerged PRs only where their behavior affects the selected journey.
4. Inspect `package.json`, `.github/workflows/ci.yml`, actual test scripts, and canonical runtime modules. Confirm the regressions still exist and are wired into CI.
5. Create a small evidence ledger: requirement, canonical authority, source path, test/command, runtime/browser, exact SHA, result, artifact, remaining gap.
6. Separate source/static, focused local test, browser/runtime, broader suite/security, and GitHub CI. Do not overwrite/reset remote commits or revive whole stacks automatically.

**Exit:** One known main SHA and a list of genuine missing/regressed behaviors supported by evidence.

### P0 — Task 1: Certify current-main payment UX (#153 and #158)

Review these first because they are the most recently observed open current-main PRs on a customer-trust boundary. Their current checks must be refreshed; PR descriptions are not test output.

**#153 checks**
- Canonical order-payment summary is the source for order-level financial state.
- A failed refresh cannot leave cached `PAID`, `PARTIAL`, or `UNPAID` state presented as current truth.
- A cached per-payment row is not rendered as authoritative when the canonical summary is unavailable.
- Checking/unavailable state is explicit; failure never fabricates success.
- Regression covers the actual failed-refresh path and runs in CI.

**#158 checks**
- Checkout says “save order to queue”; payment-method selection or receipt attachment does not confirm funds received.
- Missing/disabled payment methods fail safely rather than silently defaulting to cash.
- Receipt-storage failure permits retry and does not silently save an order missing selected evidence.
- Repeated activation during asynchronous proof processing cannot create duplicate local orders.
- Canonical summary refresh rejects stale/late results after invalidation or tenant change.
- Payment adapter IDs are normalized before projection upsert.
- Existing order IDs and Payment Core remain canonical; no frontend ledger or second payment authority is introduced.

**Combined runtime matrix:** checkout → queue → canonical summary; cover refresh success/failure, late response, tenant change, no enabled method, receipt storage failure, repeated taps, local/unlinked order, and subsequent canonical payment update. Keep order value, local order state, receipt evidence, reported tender, and verified funds separate.

**Exit:** Focused and required baseline/security checks pass on exact heads; combined journey passes or its precise blocker is recorded; no stale financial state is presented as canonical. Merge remains a user decision.

### P0/P1 — Task 2: Reassess offline outbox recovery from current main

The old #86–#98 chain was reported closed/unmerged. Historical work covered in-flight mutation guards, three-way merge, deep snapshots, Web Locks, same-tab no-lock queueing, IDB-serialized journal writes, Chromium runtime regression, and localStorage append-log/tombstone recovery. #98 also described atomic checkpointing of fallback operation IDs and cleanup-failure safety. Treat this as historical evidence, not proof about main.

1. Inspect current `app/src/storage/idb.js`, `app/src/sync/outbox-recovery-journal.js`, hydration/persistence code, tests, and CI.
2. Determine which of the above safeguards are present and covered on current main.
3. Test Web Locks available/unavailable; IDB abort and retry; cold-start hydration; two tabs/realms; IDB unavailable; localStorage write/cleanup failure; tombstone replay; stale async completion; same-event concurrent edits; and tenant/account switching.
4. Verify that aborted transactions do not advance commit markers, valid recovery records survive until successful checkpoint, cleanup failure cannot replay stale state over newer committed events, and deletes cannot be resurrected.
5. Test actual modules and browser storage. State all external stubs. A source-contract test alone is not browser verification.
6. If a gap is demonstrated, create one narrow PR from current main; do not revive the entire old chain. Do not regenerate expected hashes blindly—first understand the source/artifact contract.

**Exit:** Node 24 and real-browser tests pass on exact proposed SHA; persistence limitations are explicit; no tested loss, stale resurrection, false commit, or cross-tenant rebinding remains.

### P1 — Task 3: Browser-safe module serving and boot

1. Inspect current `backend/server.js`, static-file rules, allowlists, browser harness, and module imports.
2. Run both supported full-backend and frontend-only modes.
3. Ensure only explicitly approved browser-safe modules are served; backend internals/private source are not exposed.
4. Record 404s, missing exports, config cycles, console/page errors, and uncaught exceptions.
5. Use actual browser evidence, not source regex or HTTP-only checks as a substitute.
6. Compare current source with historical PR #90 and reuse only a demonstrated missing fix.

**Exit:** Supported modes boot with no missing required modules and no unsafe backend-tree exposure; exact runtime and CI evidence is recorded.

### P1 — Task 4: First Experience integration, only where current main has a gap

Audit current source before reusing closed PRs #84/#85/#87/#89. Start from current main and use old diffs as references only.

Acceptance matrix:
- New visitor can discover workflows without access to tenant-scoped data; pairing/auth remains fail-closed.
- Returning merchant restores the correct tenant/workspace without silently resetting identity or setup.
- Business template accepts only supported values and expresses intent, not unimplemented capability. Server-owned tenant persistence is tested if present/required.
- First product follows existing stock rules; service remains canonical `item_type: service` and creates no physical stock/inventory consequences.
- Tenant A→B→A has no leakage; durable cart/template/notes restore only as specified after reload; ephemeral checkout/tender state remains ephemeral.
- Country selector only accepts active supported packs; blank/unknown/candidate-only/regional-only values fail before persistence.
- Existing 13 UI languages and documented fallback work; language is not country, currency, legal jurisdiction, or provider readiness.
- Currency is separate; explicit valid choice is preserved and defaults come from the canonical country/money configuration path.
- Marketplace/Pack discovery is read-only and cannot activate a provider, register a seller, connect a channel, grant permissions, or mutate readiness.
- Home readiness is operation-specific; connectivity alone does not prove business readiness; actions respect permissions.
- Telegram/storefront verification and PWA channel boundaries remain intact.
- Full-backend and frontend-only boot use the documented allowlist and have no module 404s or browser errors.

Run existing regressions first; confirm their current script names and CI wiring. Test at least two tenants, roles, reloads, and failure/retry paths. Add one compact integration regression only for a real uncovered risk.

**Exit:** Combined current-main journey is browser-verified; every proposed change maps to a demonstrated gap; no broad copy of closed branches is needed.

### P1 — Task 5: Global Core and country-ready architecture

Preserve the strategy: **Global Core first; country-ready architecture from the beginning; country-by-country commercialization/localization after evidence.** Avoid Ethiopia-only core assumptions and avoid full localization of every country before commercial proof.

- Language is a global UI/content preference; existing 13-language support stays distinct from operating country.
- Country selects an eligible pack and its declared defaults; it is not inferred from language.
- Currency is distinct from language, country identity, and legal jurisdiction.
- Country packs compose declarative currency/localization defaults, tax/invoice references, country validation, compliance requirements, payment compatibility, and local marketplace/logistics adapters; they do not own core commerce or identity authority.
- Adapter mapping is not provider activation/certification. Evaluate manual payments and SMS-based payment verification against existing Payment Core; do not build a second Ethiopia payment implementation or expand provider count without evidence.
- Regional/EAC strategy contracts do not establish legal/provider readiness for every member country; use the existing country-priority/sequencing gate.
- First Experience is a routing/discovery surface, not a new capability registry, onboarding authority, payment core, or sync engine.
- Telegram and PWA are channels; POS/hardware are channels where supported, not parallel commerce authorities.
- Templates/packs communicate setup intent only. Do not promise appointments, hotel/rental capacity, warehouse execution, or vertical workflows without canonical operations.

**Country launch gate:** legal/tax review, currency correctness, provider contract/certification, server-side validation, security/audit, operational support, localization review, and an end-to-end business journey have explicit evidence.

### P1/P2 — Task 6: Existing-authority service, payment, fulfillment, logistics

1. Refresh historical service/logistics handoffs against current routes, migrations, tests, and PR state.
2. Verify request/booking, assessment, customer acceptance, payment, fulfillment, courier assignment, delivery proof, and completion as distinct states.
3. Preserve canonical chain: Marketplace Order → Seller Order(s) → Fulfillment(s) → Payment → Settlement → Delivery.
4. Enforce tenant/location authorization, idempotency, concurrency, and server-authored audit/evidence.
5. Customer acceptance is not delivery completion or courier assignment.
6. Cancellation is not proof of refund; settlement reversal waits for canonical refund confirmation where required.
7. Receipt/cash-tender reports do not change Payment Core state.
8. Inventory consequences come from canonical business/fulfillment operations; a service's legacy numeric stock field cannot create stock.
9. Do not create a second fulfillment lifecycle, inventory/payment authority, universal workflow engine, or generic transport authority.

**Exit:** The chosen journey has focused regression, integration evidence, and relevant CI on exact SHA.

### P2 — Task 7: Release readiness and regression inventory

1. Recheck inherited suspected hash mismatches in Phase 13.12.3, 21.17, and 22.0 against current source and artifact contracts; treat them as unconfirmed until reproduced.
2. Inventory all regression scripts and CI wiring; label source-only vs runtime/browser coverage.
3. Run relevant Node 24 baseline/security, Logistics L18/exit certification, browser runtime, and HTTP/SQLite integration checks on exact SHAs.
4. Record migration/deployment/config requirements, rollback behavior, audit/observability evidence, and unsupported paths for each launch slice.
5. Keep native-speaker, accessibility, legal, provider, and operational checks explicitly marked; automation does not replace them.

## 4. Evidence ledger template

| Field | Required value |
|---|---|
| Requirement | One observable behavior |
| Canonical authority | Existing API/service/store/table responsible for truth |
| Source | Exact paths and main SHA |
| Test | Existing test path and CI job/script |
| Execution | Exact command, Node/browser version, fixtures, and stubs |
| Result | PASS / FAIL / NOT TESTED / BLOCKED |
| Evidence | Output/log/artifact/run URL and tested SHA |
| Gap | Minimal missing behavior, if proven |
| Next action | One narrow patch or explicit defer reason |

## 5. Definition of done for each narrow PR

- Current base and branch head are explicit.
- Patch fixes a demonstrated gap and does not duplicate existing/current or closed historical work.
- Canonical authority, tenant scope, permission, idempotency, concurrency, and audit invariants are preserved.
- Focused regression reproduces the prior failure and passes after the fix.
- Relevant baseline/security checks have real output on the exact commit.
- Browser/runtime claims have browser/runtime evidence.
- Failure and unsupported behavior are documented.
- PR description separates verified, pending, blocked, and not-tested items.
- No merge, close, or retarget occurs without explicit user authorization.

## 6. Explicitly deferred unless evidence changes

- Universal workflow engine, all-purpose AI platform, or duplicate capability registry.
- Second order/payment/inventory/tenant/location/delivery/fulfillment authority.
- New sync engine or broad outbox rewrite without a reproduced current-main gap.
- Country rollout justified only by translated UI or country dropdown support.
- Provider expansion or duplicate Ethiopia payment implementation.
- Mega-PR combining onboarding, browser serving, offline recovery, and payment UX.
- Vertical promises such as appointment execution or hotel/rental capacity without canonical capability.

## 7. Next-chat checklist

1. Fetch current main SHA.
2. Refresh #153, #158, and #99 status/checks.
3. Review combined payment UX and report source, focused runtime, broader suite/security, CI, and unverified items separately.
4. Compare current main against closed/unmerged #84/#85/#87/#89/#90 and #86–#98 only where relevant.
5. Select the first evidence-backed gap; implement one minimal fix plus regression on an isolated branch.
6. Update this backlog only when repository evidence changes.
7. Do not merge or close PRs without explicit user authorization.


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
