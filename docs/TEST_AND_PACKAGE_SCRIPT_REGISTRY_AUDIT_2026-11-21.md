# Test and package-script registry audit

**Audit date:** 2026-11-21  
**Repository:** `T-BOT-tech/sellify`  
**Source:** current `main` package manifest and recursive Git tree.  
**Scope:** inventory and static command-target validation only. No test execution or runtime certification is claimed.

## Executive result

The root `package.json` contains **481 scripts**. Of these, 475 names match test/regression/check/verification/certification/gate/baseline naming; 69 names begin with `phase`. Static inspection found:

- **0 missing local script targets** among parsed `node` and `bash` commands.
- **11 exact duplicate-command groups** (46 script names map into those groups).
- **3 large Logistics alias families** map many separately named phase scripts to one physical regression file each.
- **1 duplicate development alias** (`dev` and `dev:backend`).
- The audit does not prove that all 481 scripts are unique tests, all are used by CI, or all remain behaviorally necessary.

This is a discoverability and test-identity problem, not evidence that the underlying regression coverage is invalid.

## Exact duplicate-command groups

| Script names | Shared command / target | Initial interpretation |
|---|---|---|
| `dev`, `dev:backend` | `npm --prefix backend run dev` | Exact convenience alias; choose one canonical name after checking docs and user workflows. |
| `phase11.4:marketplace-test`, `test:phase13.10.24-marketplace-fulfillment` | `phase0/phase11.4-marketplace-integrity-regression.mjs` | Misleading phase label on the second alias; CI separately runs the Phase 13.10.24 marketplace boundary test. |
| `phase17.3:procurement-rfq-test`, `phase17.3:rfq-response-test` | `phase0/phase17.3-rfq-response-regression.mjs` | Synonymous alias pair. |
| `phase17.3:procurement-rfq-contract-test`, `phase17.3:rfq-contract-test` | `phase0/phase17.3-rfq-contract-regression.mjs` | Synonymous alias pair. |
| `phase17.4:procurement-comparison-test`, `phase17.4:comparison-test` | `phase0/phase17.4-comparison-regression.mjs` | Synonymous alias pair. |
| `phase17.4:procurement-comparison-contract-test`, `phase17.4:comparison-contract-test` | `phase0/phase17.4-comparison-contract-regression.mjs` | Synonymous alias pair. |
| `test:gap-2-delivery-lifecycle`, `test:gap-2-delivery-exception` | `phase0/gap-2-delivery-assignment-lifecycle-regression.mjs` | Two names for the same lifecycle regression; check whether distinct assertions exist before splitting or renaming. |
| `test:phase16.13.13`, `test:phase16.13.17` | `phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs` | Phase 16.13.17 alias points to a 16.13.13-named test; likely stale alias or cumulative evidence reference. |
| `test:logistics-l11.8`, `test:logistics-l11.8-l11.9`, `test:logistics-l11.10` through `test:logistics-l11.16` | `phase0/logistics-scheduling-decision-regression.mjs` | Nine names point to one 889-line test whose header identifies it as L11.8. These names do not independently prove L11.9–L11.16 coverage. |
| `test:logistics-l20.1` through `test:logistics-l20.10` | `phase0/logistics-network-corridor-intelligence-regression.mjs` | Ten names point to one 552-line test whose header identifies it as L20.1. They are not ten independently executed test files. |
| `test:logistics-l21.1` through `test:logistics-l21.11` | `phase0/logistics-external-network-expansion-regression.mjs` | Eleven names point to one 920-line test. No distinct per-subphase files are invoked by these aliases. |

## Important interpretation

The L11, L20, and L21 alias families need special care:

- The L11.8 test imports multiple scheduling decision/confirmation/start/completion/failure/terminal contracts and lifecycle/adversarial/closure invariants. That may provide broad cumulative coverage, but its file header identifies the test as L11.8.
- The L20.1 test covers multiple network/corridor intelligence signals in one regression, but the script aliases L20.2–L20.10 all invoke that same file.
- The L21 test covers external network integration, inbound evidence, canonical handoff, adapter trust/capabilities, and retry boundaries in one file, but aliases L21.1–L21.11 all invoke that same file.

Do not claim one passing command per subphase as independent evidence when all commands execute the same file. If the phases are intentionally cumulative slices, document that explicitly in the phase handoffs and CI. If separate acceptance is required, add genuinely distinct tests before adding separate script names.

## CI relationship

The current `.github/workflows/ci.yml` calls named Logistics L11 scripts through L11.8 and calls separate L18 and L8–L21 cumulative certification gates. The three large alias families are not independently executed as distinct tests by virtue of their multiple package aliases. Keep the cumulative certification gate as the source of release evidence; do not infer certification from aliases.

## Safe consolidation policy

1. Keep all current script names until references in workflows, docs, local developer instructions, and external automation have been checked.
2. Choose one canonical script name per physical regression file. Preserve compatibility aliases only where there is a demonstrated consumer.
3. For a multi-phase cumulative regression, give it one accurately named script and document its exact coverage; do not create ten names that imply ten distinct test executions.
4. Split tests only when a phase has independently specified acceptance criteria and a distinct regression adds real coverage.
5. Any package-script edit must be followed by JSON validation, static target validation, CI-reference validation, and the affected regression runs.

## Full root-script target and CI-reference inventory (follow-up, 2026-11-21)

The root script manifest was re-read from the current source commit and compared with the recursive Git tree and current `.github/workflows/ci.yml`.

| Static inventory | Count | Interpretation |
|---|---:|---|
| Root scripts | 481 | Complete manifest enumeration |
| Direct Node file commands | 473 | Targets resolve to tracked files in the current tree |
| Direct shell file commands | 2 | Targets resolve to tracked shell files |
| Nested-package commands | 6 | Commands target the existing `backend/` or `app/` package directories |
| Unresolved command targets | 0 | Directory targets were checked as directories, not incorrectly treated as missing files |
| Script names directly referenced in CI | 197 | Literal script-name references found in the current CI workflow |

The 197 CI references are not a count of distinct test files or complete dependency coverage. Scripts absent from direct CI text may be invoked by another npm script, a regression/gate script, developer workflow, or external automation. Therefore the remaining 284 names are **not** classified as unused.

The direct command inventory is strongly Node-centric: 473 Node-file commands and two shell-file commands, with six commands delegating to nested package scripts. The previous static target check reported five false missing targets because it treated `npm --prefix backend` and `npm --prefix app` directory arguments as file paths; this follow-up corrected that interpretation and confirms all six nested-package directories exist.

### Classification status

- **Complete:** all 481 manifest entries enumerated; direct Node/shell targets and nested package directories resolve against the current tree.
- **Partial:** direct CI reference mapping (197 script names) and exact duplicate-command groups (11 groups / 46 names).
- **Not yet established:** full transitive npm-script call graph; references from all documentation and scripts; local developer and external automation consumers; obsolete/unreferenced classification.
- **No deletions:** no script or test was removed based on this static inventory.

The next safe step is to build a transitive consumer map for package-script-to-package-script calls and the source-level acceptance checks that inspect script names. Any cleanup decision must use that map plus workflow and documentation references; absence from CI alone is not evidence of obsolescence.

## Recommended next action

Perform a consumer/reference audit of the 11 duplicate groups, then make a small alias cleanup batch only for names proven unused. Separately map every package script to its target file and classify each target as focused regression, cumulative gate, diagnostic, operational command, or obsolete/unreferenced. Do not delete tests or weaken CI as part of this naming cleanup.

## Reference and CI-consumer audit (follow-up, 2026-11-21)

The current `main` versions of `.github/workflows/ci.yml`, the Logistics exit-audit scripts, the GAP-2 production-readiness regression, the GAP-2 source-of-truth record, the relevant test files, and package scripts were inspected. This section supersedes any implication that every duplicate alias is safe to remove.

### Confirmed consumers and dispositions

| Alias family | Current consumers / evidence | Disposition |
|---|---|---|
| Logistics L11.8 / L11.9–L11.16 | CI runs the distinct L11.1, L11.3–L11.8 regressions. The Logistics master-specification exit audit uses `test:logistics-l11.16`, and the cumulative L8–L21 final certification invokes it. All those L11.8–L11.16 names point to the same 889-line L11.8-headed regression file, which imports and checks multiple scheduling decision/lifecycle contracts. | Preserve the phase alias required by the exit gate. Do not describe each alias as a separate test file or independent execution. A future phase-evidence review should reconcile the L11.16 acceptance label with the actual shared test content. |
| Logistics L20.1–L20.10 | The master-specification exit audit and final certification use `test:logistics-l20.10`. All ten names point to the same 552-line network/corridor intelligence regression. | Preserve the L20.10 gate alias; document that it executes one cumulative regression. |
| Logistics L21.1–L21.11 | The master-specification exit audit and final certification use `test:logistics-l21.11`. All eleven names point to the same 920-line external-network expansion regression. | Preserve the L21.11 gate alias; document that it executes one cumulative regression. |
| GAP-2 lifecycle / exception | `gap-2-production-readiness-regression.mjs` asserts that both script names exist; the GAP-2 source-of-truth record lists both. The shared 506-line test checks assignment lifecycle, proof immutability, exception reason, exception resolution, and reassignment authorization. | Keep both package aliases for compatibility and readiness assertions, but execute the shared regression once in CI. |
| Marketplace Phase 11.4 / Phase 13.10.24 fulfillment | Both aliases map to the same 404-line marketplace integrity regression. The separate `test:phase13.10.24-marketplace-boundary` is a different regression and remains in the Phase 13.10.24 job. | Keep both package aliases for compatibility; run the shared marketplace integrity test once in CI under its canonical Phase 11.4 name. |
| Phase 16.13.13 / 16.13.17 | Both names map to the Phase 16.13.13 canonical-provider-application contract regression. No separate Phase 16.13.17 test file is implied by the alias. | Preserve for now; audit the phase 16.13.17 acceptance record before deciding whether it is a deliberate cumulative alias or a stale name. |
| Phase 17.3 and 17.4 procurement aliases | CI uses the longer `procurement-` names for RFQ response and comparison integration tests; shorter aliases point to the exact same files. | Preserve the CI-facing canonical names. Short aliases are cleanup candidates only after all repository and external references are checked. |
| `dev` / `dev:backend` | README and UI evaluation environment documentation explicitly instruct developers to use `dev:backend`. Both commands invoke the same backend development script. | Preserve `dev:backend` as documented developer entry point. Treat `dev` as a compatibility alias until consumer references are fully reconciled. |

### CI deduplication applied

Two duplicate test executions were removed from `.github/workflows/ci.yml` without deleting package scripts or regression files:

1. The Phase 13.10.24 job no longer repeats the marketplace integrity regression under `test:phase13.10.24-marketplace-fulfillment`. The baseline CI job still runs the same test once using `phase11.4:marketplace-test`, now with an accurate description covering checkout, fulfillment, payment, and refund integrity. The distinct Phase 13.10.24 marketplace boundary regression remains in its dedicated job.
2. GAP-2 lifecycle and exception aliases remain registered, but CI runs their shared regression once using `test:gap-2-delivery-lifecycle`, with a step name that explicitly says it covers both lifecycle and exception resolution. The redundant second invocation was removed. GAP-2.12 still verifies that both public script aliases exist and now accepts either alias as the single CI invocation, because both resolve to the same regression file.

No test file, package script, canonical authority, or phase acceptance contract was deleted or weakened. The CI workflow change is a configuration-only reduction in duplicate executions; the pushed commit's workflow runs must pass before this cleanup is considered validated.

### Search-index caveat

GitHub's code-search excerpts returned an older indexed package/CI revision (`c4c7227...`) rather than the current `main` commit during this audit. Therefore search-index result counts were not treated as authoritative. The consumer statements above are based on files fetched directly from current `main`. The full repository-wide documentation and external automation reference audit remains open.


## Nested package and runtime manifest audit (follow-up, 2026-11-21)

The root, backend, and app package manifests, root lockfile, Node version files, root README, and devcontainer setup were compared.

| Area | Current evidence | Result |
|---|---|---|
| Root package | `sellify@0.2.0`, private, ESM, Node `>=24`; 481 scripts; Playwright is its only dev dependency. | Consistent with the root lockfile and Node floor. |
| Backend package | `sellify-backend@0.2.0`, private, ESM, Node `>=24`; three operational scripts; no package dependencies. | Consistent with the root deployment model; backend uses Node built-ins. |
| App package | `stall-ledger@0.1.0`, private, Node `>=24`; 19 scripts; `serve` is a dev dependency. | Internal name/version differ from root/backend; no evidence this private name is published. Do not rename it without checking package references and release conventions. |
| Node pinning | Both `.nvmrc` and `.node-version` contain `24`; root/backend/app engines all require `>=24`. | Consistent runtime floor. |
| Lockfiles | Only root `package-lock.json` exists. It contains root Playwright dependencies but not app's `serve` dependency. | App-only dev setup needs its own install; no reproducible app lockfile is committed. |
| Devcontainer | `postCreateCommand` runs root `npm install --ignore-scripts`; backend development uses the root/backend script. | Does not install app's optional static-server dependency. |

### Broken app test-script paths fixed

The app package had 17 test scripts. Nine were already correctly written as `../phase0/...`; the other eight used `phase0/...` even though there is no `app/phase0/` directory. Those eight scripts could not resolve their target files when run from the app package.

Updated `app/package.json` so all 17 phase-test scripts resolve to the shared root `phase0/` regression files. Static validation against the current recursive Git tree confirms all 17 test targets exist. The two remaining scripts are `dev` and `start`, which invoke the declared `serve` binary.

### Frontend-only development install instruction fixed

The root README previously told developers to run `npm run dev:app` without explaining that `serve` is not installed by the root package install. The root lockfile confirms `serve` is not a root dependency. Updated the README to instruct developers to run:

```bash
npm --prefix app install
npm run dev:app
```

The production deployment remains unaffected: the backend serves the app statically, and `serve` is only needed for the optional frontend-only local development server.

### Remaining manifest decisions — not changed

- App package name `stall-ledger` and version `0.1.0` differ from root/backend `sellify` / `sellify-backend` version `0.2.0`. This is a naming/version hygiene issue, not proven runtime breakage. Leave unchanged pending an explicit package/release identity decision.
- No app-local `package-lock.json` is committed. A lockfile should be generated with npm against the exact manifest and registry resolution, then committed and verified; do not hand-author it.
- Root package has no npm workspaces. Do not add workspaces just to solve the optional frontend dev-server install without first deciding the intended package ownership model.

Static target validation is not the same as executing the app-local scripts. The root CI workflow currently does not install app-local dependencies or run the app package's test aliases. These changes therefore remain pending runtime verification by an app-package install/test run.


### GAP-2 CI deduplication follow-up — 2026-11-21

The first CI run after deduplicating the shared GAP-2 lifecycle/exception regression failed at GAP-2.12 because its source-level check required the literal workflow command `test:gap-2-delivery-lifecycle`. Switching to that alias exposed the same overly strict assumption in reverse: the check then required `test:gap-2-delivery-exception`. Both package aliases intentionally point to the same regression file, so CI should execute one alias once rather than duplicate the test to satisfy a string-presence assertion.

The workflow invokes `test:gap-2-delivery-lifecycle` once. The GAP-2.12 readiness regression was corrected to require both aliases in `package.json` while accepting either one as the single CI invocation. No delivery behavior assertion, package alias, or Logistics authority was removed. The final correction is commit `f2b40422850993162b02273f748c61df31490c4f`; the complete Sellify CI run `44930608852` passed all five jobs, including baseline (Node 24), Logistics L18, Logistics exit certification, Phase 13.10.24, and Phase 21 capacity evidence. This verifies the CI deduplication and readiness-check correction on that commit.
