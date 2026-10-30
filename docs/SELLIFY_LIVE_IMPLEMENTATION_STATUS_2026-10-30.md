# Sellify — Live Implementation Status and Evidence Ledger

**Snapshot:** 30 October 2026 (UTC+03:00)  
**Repository:** `T-BOT-tech/sellify`  
**Inspected main:** `4d459ab890b86ebdc1235303325f66aa8e8be804`  
**Purpose:** Superseding repository-grounded status for the 27–29 October plans. This document distinguishes merged implementation, CI evidence, incomplete integration certification, and external launch evidence.

## 1. Status rules

- **Merged/source present:** the change is in the inspected `main` history or current source.
- **CI PASS on PR candidate:** the named GitHub job/step passed on the exact PR merge-candidate SHA. It is not automatically a direct main-branch run.
- **Source/test present:** code and regression exist; this alone is not runtime certification.
- **PARTIAL / NOT CERTIFIED:** individual component tests pass but the complete user journey, external provider, or deployment conditions have not been demonstrated.
- **BLOCKED:** an observed check failed. Record the exact failing command and cause.
- Closed/unmerged historical PRs are not implementation backlogs by default. Compare current main and its tests before reviving anything.

## 2. Live GitHub checkpoint

| Item | Observed state | Evidence / interpretation |
|---|---|---|
| `main` | `4d459ab890b86ebdc1235303325f66aa8e8be804` | Latest commit observed in repository history at this audit. |
| PR #188 — Phase 20.12 CI gate | Open, unmerged; base `4d459ab890b86ebdc1235303325f66aa8e8be804`; head `3e3169e01c0764a8db6c25cf93abf7e1924b8161` | CI-only change to `.github/workflows/ci.yml`; do not merge without explicit authorization. |
| PR #188 Sellify CI | Failed | Run `40971050897`; merge candidate `e393e8709ab4df8444c858fc8c1e40c96359e6df`. Baseline failed at Phase 20.8 after Phase 20.1–20.7 passed. |
| PR #188 Repository Security Checks | Passed | Run `40971050899`; source-hygiene job passed. |
| PR #188 Logistics L18 | Passed | Job `logistics_l18 (24)` in run `40971050897`. |
| PR #188 Logistics exit certification | Passed | Job `logistics_exit_certification` in run `40971050897`; L1–L7 and L8–L21 cumulative gates completed. |
| Direct status for inspected main SHA | No combined status entries returned by the queried status endpoint | Do not describe this as a direct main CI pass. |

### Exact Phase 20.8 failure

The cumulative Phase 20.12 job ran Phase 20.1–20.7 successfully, then stopped at:

```
Error: Invalid logistics provider capability: unsupported source: carrier
at phase0/phase20.8-cross-border-logistics-regression.mjs:59
```

The test fixture in `phase0/phase20.8-cross-border-logistics-regression.mjs` supplies `source: 'carrier'`. The canonical validator in `app/src/verticals/logistics/provider-capability-contract.js` allows only:

`provider`, `adapter`, `network`, `manual`, `sellify`.

This is a concrete fixture/contract mismatch. Correct the fixture to use the intended supported provenance (likely `provider` or `adapter`, selected consistently with the evidence source), then run:
1. `npm run test:phase20.8`
2. `npm run test:phase20.12`
3. PR #188 Sellify CI and Repository Security Checks on the exact updated head.

Do not broaden the source allowlist merely to satisfy an invalid fixture. Phase 20.9–20.11 and the nested downstream checks in Phase 20.12 were not reached in the failed cumulative run. Although earlier independent Phase 16/19 baseline steps passed, do not report the complete Phase 20.12 gate as passed.

## 3. Work that has materially landed — do not schedule as unimplemented

### Merchant experience and checkout
- #157 action-oriented Home command center merged.
- #159 checkout now clarifies order save vs payment confirmation; #160 completes payment-state copy for 13 locales.
- #168 improves the first-product empty state.
- #170 separates catalog readiness from connectivity.
- #182 routes the J5 low-stock action to canonical inventory.
- #183 preserves Phase 0 backend startup diagnostics.
- #164 preserves the distinction between restaurant payment intent and canonical financial state.
- #165 reconciles marketplace refunds through Payment Core; split-refund settlement remains held until required refunds succeed.

**Consequence:** historical #153/#158 are not the current payment UX implementation task. Their relevant work was superseded by merged current-main changes. Do not reopen them unless a new failure is demonstrated.

### Service identity, Service Commerce, and inventory
- #167 and #174–#178 address legacy service identity across opening balances, frontend sync, marketplace listing, catalog conversion/stock guards, and Warehouse UI.
- #179 covers service identity at the procurement receiving boundary.
- #171 adds the canonical service-booking operator workspace; #172 adds browser interaction regression.
- Current baseline CI on PR #188's merge candidate passed service catalog contract, service booking lifecycle, persistence, scheduling authority boundary, operator workspace, operator browser interaction, HTTP booking journey, frontend sync/business-template persistence, and ecosystem discovery steps.

**Consequence:** do not rebuild service catalog, booking lifecycle, or Warehouse service exclusions. Remaining work is integration/product certification only where a real journey or external operation is not covered.

### Procurement
- #179–#181 establish service identity at receiving, register procurement lifecycle regressions, and add the cumulative Phase 17.10 exit gate to CI.
- In PR #188's baseline run, Phase 17.1–17.10 steps completed successfully before the later Phase 20.8 failure.

### Logistics and delivery
- Logistics L1–L21 is represented by existing canonical scheduling, fulfillment, delivery assignment, external network boundary, and certification work.
- PR #188's Logistics L18 job and L1–L21 exit certification both passed.
- Service booking scheduling remains evaluation-only unless canonical capacity/authorization evidence exists; booking, customer acceptance, assignment, delivery proof, and completion remain distinct.

**Consequence:** no generic transport authority, duplicate fulfillment lifecycle, provider registry, or second logistics execution engine is justified by this snapshot.

### Offline-first outbox and browser module serving
The PR #188 baseline run passed these named steps:
- outbox tenant-scope regression;
- offline outbox recovery journal regression;
- localStorage fallback race regression;
- offline outbox browser runtime regression;
- browser module serving boundary regression;
- browser module serving HTTP regression;
- production server browser-module HTTP regression;
- full-app Chromium smoke against development and production servers.

**Consequence:** these are not currently demonstrated as missing features. Do not revive the closed #86–#98 or #90 branches wholesale. The tests passing does not prove every possible storage-denial, multi-tab, browser, or tenant-switch scenario; add coverage only for a specific uncovered invariant or reproduced defect.

### Country packs, platform, discovery, and cross-border
- #184 adds the Phase 14.13 country-pack cumulative regression and Phase 14.15 final snapshot to baseline CI.
- #185 adds Phase 15.21 Node 24 country-expansion certification.
- #186 adds Phase 16.14 final platform snapshot.
- #187 adds Phase 19.12 cumulative Discovery Fabric exit certification.
- The PR #188 candidate baseline passed the Phase 14, Phase 15, Phase 16, and Phase 19 baseline steps before Phase 20.12 failed.
- Phase 20.1–20.7 passed within the Phase 20.12 cumulative run; Phase 20.8 failed as described above.

**Consequence:** country-ready architecture, Discovery Fabric, and Cross-Border Commerce coordination have advanced well beyond the earlier plan's snapshot. A green country/platform contract gate is not a country launch approval and does not prove legal, provider, tax, localization, support, or deployment readiness.

## 4. First Experience — revised status

| Area | Current assessment | What remains |
|---|---|---|
| First catalog item / product vs service | Substantially implemented; named regressions passed in PR #188 candidate baseline | Validate the full merchant journey and any remaining UX friction. |
| Business-template persistence | Regression is invoked through `test:service-catalog-frontend-sync` and passed in the candidate baseline | Confirm the exact intended tenant A→B→A behavior in one integrated browser journey. |
| Country-pack onboarding integrity | Regression passed in candidate baseline | Country choice must remain separate from provider activation and legal launch readiness. |
| Home attention/readiness | Home command-center and catalog/connectivity changes merged; relevant tests passed | Confirm end-to-end operation-specific readiness in the real merchant flow. |
| Marketplace/pack discovery and channel boundaries | Existing discovery, storefront, Telegram, and channel tests exist | Keep discovery read-only and verify the user journey does not imply activation or readiness. |
| Combined First Experience journey | **PARTIAL / NOT CERTIFIED** | One browser-level journey covering new merchant → business setup → first item → reload → tenant A/B/A → first sale → Home readiness, with permission and failure/retry cases. |

Do not convert this integration gap into a broad claim that onboarding or business-template persistence is absent. The individual component work already exists.

## 5. Revised ordered execution

### P0 — Close Phase 20.8 / Phase 20.12 CI blocker
- Correct the invalid fixture provenance in the existing Phase 20.8 regression.
- Run focused Phase 20.8 and cumulative Phase 20.12 locally/CI.
- Verify the updated PR #188 head, all job-level results, and security checks.
- Keep #188 open until checks pass; merge remains a user decision.

### P1 — Complete First Experience integration certification
- Reuse the existing onboarding, catalog, business-template, country-pack, Home, and channel authorities.
- Add only one integrated browser regression for uncovered cross-component risks.
- Include two tenants, reload, tenant switching, role/permission differences, persistence failure/retry, and first-sale readiness.
- Do not duplicate tenant persistence, capability discovery, or setup authorities.

### P1 — Country/deployment operational evidence
- Use `docs/DEPLOYMENT-CERTIFICATION.md` as the gate.
- Separate SOURCE CERTIFIED, DEPLOYMENT VERIFIED, and PRODUCTION OPERATIONAL.
- Obtain controlled tenant isolation, SQLite restart persistence, backup/restore, real Telegram if enabled, live payment provider evidence if enabled, and Android/mobile device validation.
- Country commercialization additionally needs legal/tax review, provider contract/certification, localization review, support, and operational evidence.

### P2 — Product expansion only after the above evidence
- Continue service/parcel/cross-border use cases as compositions of canonical commerce, payment, fulfillment, inventory, and logistics.
- No new industry-specific code where existing transaction behavior and capabilities can be configured.
- Do not create a universal workflow engine, generic transport authority, duplicate provider registry, second Payment Core, or broad outbox rewrite.

## 6. Explicitly not outstanding by default

Do not list the following as unimplemented solely because old PRs were closed:
- checkout/payment confirmation clarity (#159/#160 merged);
- Payment Core marketplace refund reconciliation (#165 merged);
- first product/Home readiness/low-stock UX (#168/#170/#182 merged);
- service catalog legacy identity and Warehouse exclusion (#167, #174–#179 merged);
- service booking operator workspace/browser interaction (#171/#172 merged);
- offline outbox recovery/browser runtime and browser module serving (named CI regressions passed on PR #188 candidate);
- country-pack, Phase 15, Phase 16, and Phase 19 cumulative CI coverage (#184–#187 merged).

## 7. Verification boundary and next-chat kickoff

Always refresh main SHA and PR #188 head/checks before execution. Current CI evidence is the PR merge candidate `e393e8709ab4df8444c858fc8c1e40c96359e6df`, not a direct main run.

**Next action:** fix the Phase 20.8 fixture's unsupported `carrier` provenance value, run the focused and cumulative gates, and inspect exact-head CI. Then proceed to the combined First Experience browser journey and deployment/country-launch evidence. Do not merge, close, or retarget any PR without explicit authorization.
