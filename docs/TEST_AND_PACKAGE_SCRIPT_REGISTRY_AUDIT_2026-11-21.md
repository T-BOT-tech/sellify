# Test and package-script registry audit

**Audit date:** 2026-11-21  
**Repository:** `T-BOT-tech/sellify`  
**Source:** current `main` package manifest and recursive Git tree.  
**Scope:** inventory and static command-target validation only. No test execution or runtime certification is claimed.

## Executive result

The root `package.json` contains **481 scripts**. Of these, 475 names match test/regression/check/verification/certification/gate/baseline naming; 69 names begin with `phase`. Static inspection found:

- **0 missing local script targets** among all parsed direct Node and shell commands and nested-package directory targets.
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
| Direct Node file commands | 474 | Targets resolve to tracked files in the current tree |
| Direct shell file commands | 1 | Target resolves to a tracked shell file |
| Nested-package commands | 6 | Commands target the existing `backend/` or `app/` package directories |
| Unresolved command targets | 0 | Directory targets were checked as directories, not incorrectly treated as missing files |
| Script names directly referenced in CI | 197 | Literal script-name references found in the current CI workflow |

The 197 CI references are not a count of distinct test files or complete dependency coverage. Scripts absent from direct CI text may be invoked by another npm script, a regression/gate script, developer workflow, or external automation. Therefore the remaining 284 names are **not** classified as unused.

The direct command inventory contains 474 direct Node-file commands, one shell-file command, and six nested-package commands (481 total). All 474 Node targets resolve to tracked files, the shell target resolves to a tracked file, and all six `npm --prefix` package-directory targets resolve to existing directories. The earlier inventory's 473 Node / two shell breakdown was a counting error; this follow-up corrects it. The earlier five apparent missing targets were false positives caused by treating `npm --prefix backend` and `npm --prefix app` directory arguments as file paths.

### Classification status

- **Complete:** all 481 manifest entries enumerated; direct Node/shell targets and nested package directories resolve against the current tree.
- **Partial:** direct CI reference mapping (197 script names) and exact duplicate-command groups (11 groups / 46 names).
- **Not yet established:** full transitive npm-script call graph; references from all documentation and scripts; local developer and external automation consumers; obsolete/unreferenced classification.
- **No deletions:** no script or test was removed based on this static inventory.

The next safe step is to build a transitive consumer map for package-script-to-package-script calls and the source-level acceptance checks that inspect script names. Any cleanup decision must use that map plus workflow and documentation references; absence from CI alone is not evidence of obsolescence.

## Root script target multiplicity and script identity (follow-up)

A full current-main enumeration of the 481 root scripts yields:

| Command type | Entries | Validation |
|---|---:|---|
| Direct `node <file>` | 474 | All target files exist in the tracked tree |
| Direct `bash <file>` | 1 | Target file exists in the tracked tree |
| `npm --prefix backend/app` | 6 | All package directories exist |
| **Total** | **481** | **No unresolved direct target** |

The 474 Node command entries resolve to **440 distinct tracked files**:

- 430 files have exactly one root script name.
- 7 files have exactly two root script names.
- 3 files have larger alias families of 9, 10, and 11 names respectively.
- Therefore, 44 script names point to the 10 multi-name Node target files. These names are not 44 distinct test programs.
- Including the `dev` / `dev:backend` duplicate package command, the manifest has 11 duplicate-command groups involving 46 names, consistent with the earlier duplicate inventory.

The 10 Node target groups are the Marketplace pair; four Procurement pairs; the GAP-2 lifecycle/exception pair; the Phase 16.13.13/16.13.17 pair; and the Logistics L11, L20, and L21 alias families.

This establishes **script-name-to-file multiplicity**, not independent assertion coverage. In particular, the L11.8 regression file's own header identifies it as L11.8, while L20 and L21 each have one shared regression file for their respective alias families. Their broader acceptance semantics must be judged from the assertions and source-of-truth records, not the number of package aliases.

## Phase acceptance depth review: Logistics L11/L20/L21 and Procurement 17.3/17.4

This review inspected the actual regression source files, the Logistics master-specification exit audit, the L20/L21 contract modules, and the Phase 17.3/17.4 handoff documents.

### Logistics L11 — Scheduling

**Observed source coverage:** distinct numbered tests exist for L11.1 contract normalization, L11.3 persistence/migration/schema, L11.4 transactional service, L11.5 central authorization, L11.6 pure feasibility, L11.7 feasibility integration, and L11.8 transactional decision/lifecycle boundaries. In addition, two separately registered and CI-executed tests exist: `test:logistics-scheduling-http` (521 lines of real HTTP/server coverage) and `test:logistics-scheduling-ui` (timezone/UI contract coverage). These are not numbered L11.2 or L11.9 subphase tests in the current manifest. The L11.8 test is 889 lines and covers scheduling decision, confirmation, start, completion, failure, terminal states, organization scope, authorization, idempotency, optimistic versioning, audit requirements, adversarial cases, and closure invariants.

**Alias finding:** `test:logistics-l11.8`, `test:logistics-l11.8-l11.9`, and L11.10–L11.16 all invoke that same L11.8 regression. Their names do not prove separate L11.9–L11.16 assertions. The master-specification exit audit requires only `test:logistics-l11.16` as the L11 Scheduling evidence identifier. The L8-L21 cumulative gate directly executes the single L11 scheduling decision regression once.

**Gap / unknown:** no L11.2-labelled script/regression or separate L11.9–L11.16 regression files were identified. The unnumbered HTTP and UI tests provide additional functional coverage but cannot be assigned to L11.2 or later subphases without a source specification. This is a documentation/acceptance traceability gap unless the approved master specification explicitly defines independent subphase requirements. Do not create tests solely to fill numeric numbering gaps.

**Disposition:** preserve all aliases for now because the final alias is required by the master exit audit; do not count each alias as independent coverage. CI currently executes L11.1, L11.3–L11.8, plus the separate HTTP and UI tests. Reconcile the missing numeric labels and L11.9–L11.16 against the approved Logistics master specification before claiming those subphases individually complete.

### Logistics L20 — Network / Corridor Intelligence

The single L20 regression file is headed L20.1 and is 552 lines. It exercises seven derived metrics: corridor demand, backhaul opportunity, depot throughput, capacity shortage, service-area gap, recurring demand, and provider-capacity visibility. It checks organization/corridor/service-profile observations, arithmetic, invalid inputs, and explicit non-authority boundaries (no persistence, routing, provider selection, assignment, transaction, stock, fulfillment, or capacity-ledger authority). The contract module is a derived-intelligence boundary.

All ten package names L20.1–L20.10 invoke this same file. The master exit audit requires only `test:logistics-l20.10`; the cumulative gate executes the L20 regression once.

**Gap / unknown:** no individual L20.2–L20.10 regression files or per-subphase acceptance mapping were identified. The existing L20.1 regression has broad metric coverage, but it does not by itself prove nine separately specified subphases.

**Disposition:** preserve the final alias required by the master exit audit and retain compatibility names until references are reconciled. Treat L20.2–L20.10 independent acceptance as unverified, not as ten tests passed.

### Logistics L21 — External Network Expansion

The single L21 regression is 920 lines. Its contract module is 1,177 lines and explicitly states that it defines a provider-neutral boundary, not a concrete provider adapter. Regression assertions cover external inbound observations, duplicate/idempotency handling, integration lifecycle, adapter trust and capability declarations, canonical handoff/reconciliation, and restrictions against direct canonical-domain mutation or creating provider-selection, routing, assignment, fulfillment, inventory, payment, settlement, identity, or event-store authorities.

All eleven package names L21.1–L21.11 invoke this same regression. The master exit audit requires only `test:logistics-l21.11`; the cumulative gate executes the L21 regression once.

**Gap / unknown:** no separate L21.2–L21.11 test files or subphase-specific acceptance map were identified. The contract explicitly says no concrete logistics provider adapter exists. Therefore L21 boundary-contract coverage must not be described as a completed live provider integration.

**Disposition:** preserve the final required alias. Treat per-subphase acceptance and concrete provider integration as unverified/deferred unless separate evidence exists.

### Procurement Phase 17.3 / 17.4

These are different from the Logistics alias families:

- Phase 17.3 has two genuinely distinct targets: RFQ/supplier-response integration and RFQ contract/state-transition regression. The implementation handoff defines RFQ as Procurement-owned and explicitly excludes Inventory, Payment, B2B Quote/PO, Commerce Order, settlement, and award mutation.
- Phase 17.4 has two genuinely distinct targets: deterministic supplier/line comparison integration and comparison contract/policy regression. Its handoff documents snapshotting, deterministic ranking, comparable-cost calculations, partial line coverage, authorization, and the explicit absence of award, PO, inventory, payment, settlement, landed-cost, and AI ranking behavior.
- The longer `procurement-rfq-test` / `procurement-rfq-contract-test` and `procurement-comparison-test` / `procurement-comparison-contract-test` names are the CI-facing names. The shorter names are compatibility aliases to the same respective files.

**Disposition:** retain both targets per phase; no evidence supports deleting either behavioral regression. Short aliases are compatibility candidates only after complete consumer reconciliation.

### Reconciliation against the approved Logistics master specification

The earlier source search was incomplete: the governing document was present in the user's Library, not tracked in the repository tree. I retrieved and reviewed the full **SELLIFY LOGISTICS — MASTER SPECIFICATION & IMPLEMENTATION PLAN** (1,038 lines). Its status is **Proposed master product specification**. It defines L8–L21 as capability layers, but does not define numbered subphases such as L11.2, L11.9–L11.16, L20.2–L20.10, or L21.2–L21.11.

This changes the earlier interpretation: the missing numbered subphase tests are not, by themselves, evidence of missing requirements. Those subphase labels are not in the governing specification.

### L11 — Scheduling: specification-to-source mapping

The master specification's L11 requirement is four scheduling modes: on-demand, scheduled, time-windowed, and recurring, initially for Regional Freight and B2B. It explicitly states that scheduling is coordination, not a second fulfillment authority.

Current source evidence:
- `logistics-scheduling-contract-regression.mjs` checks the normalized scheduling contract, existing canonical references, on-demand/scheduled/windowed/recurring mode constraints, timezone and validity rules, and the absence of persistence/mutation authority at the pure contract boundary.
- `logistics-scheduling-persistence-regression.mjs` verifies the scheduling migration/schema, canonical foreign keys, indexes, and persistence shape.
- `logistics-scheduling-service-regression.mjs` checks transactional create/read/transition behavior.
- `logistics-scheduling-authorization-regression.mjs` checks the existing central authorization authority and role/scope decisions.
- `logistics-scheduling-feasibility-regression.mjs` and `logistics-scheduling-feasibility-service-regression.mjs` test feasibility and the UNKNOWN/no-authority boundary.
- `logistics-scheduling-decision-regression.mjs` tests lifecycle decisions and transactional invariants.
- The separately registered HTTP and UI regressions exercise the actual backend HTTP boundary and timezone/UI contract. CI runs these alongside L11.1 and L11.3–L11.8.
- The master spec does not require a separate L11.2 test or separately numbered L11.9–L11.16 tests.

**Assessment:** the four scheduling modes and the shared scheduling coordination boundary have meaningful contract, persistence, service, authorization, feasibility, lifecycle, HTTP and UI evidence. The repository's tests do not, from the inspected evidence alone, prove dedicated end-to-end Regional Freight and B2B user journeys for every mode. Classify the shared scheduling capability as implemented with service-profile journey coverage not separately verified; do not mark fictitious numeric subphases missing.

### L20 — Network / Corridor Intelligence: specification-to-source mapping

The master specification defines exactly seven derived intelligence outputs: corridor demand, backhaul opportunities, depot throughput, capacity shortages, service-area gaps, recurring demand, and provider-capacity visibility. It says this work should follow real operational data and must not create a transaction authority.

The current 552-line L20.1 regression and 737-line contract define and test those seven metrics, normalization/validation, calculations, and the derived/non-authoritative boundary. The ten package names L20.1–L20.10 are not ten requirements in the master spec; only one L20 capability layer is specified. The cumulative gate executes the L20 regression once.

**Assessment:** the seven-metric derived-intelligence contract is implemented and regression-tested. Live intelligence driven by a demonstrated production/operational event stream is not established by the synthetic contract regression. Classify the contract layer as implemented; classify production-data integration/operational intelligence as not verified, not as nine missing subphases.

### L21 — External Network Expansion: specification-to-source mapping

The master specification says to extend the existing Canonical Contract → Integration → Adapter → Provider path for external carriers, courier networks, 3PLs, fleet operators, transport associations and regional networks. It explicitly prohibits provider-specific architecture in Logistics core.

The current L21 contract and 920-line regression define external integration profiles, trust, capability declaration, inbound evidence, canonical handoff/reconciliation and non-authority constraints. Further inspection of the current-main tree found existing generic provider/integration components: Phase 16.4 Platform Integration, Phase 16.13.3 Logistics Provider Adapter contract, Phase 16.13.11 Logistics Network Integration composition, Phase 16.13.14 server execution composition, Phase 16.13.15 process-local executor binding, and Phase 16.13.16 deployment adapter binding. These are real reusable boundaries, not merely future plans. However, execution is supplied through an injected/deployment executor; the inspected modules do not provide a production provider-specific network transport, credential store, callback HTTP ingress, retry engine, or live provider configuration. The L21 contract's former header incorrectly said no Logistics provider/adapter authority existed; that comment was corrected in commit `d84e398a9f39e615b047a9423c5f004770ae1360`. The eleven package names L21.1–L21.11 are aliases for this one L21 regression, not eleven spec requirements.

**Assessment:** provider-neutral external-network boundary and its regression are implemented. A concrete external provider adapter, credentials/transport integration and live provider execution are not established by this evidence. Classify L21 as partially implemented at the boundary level, with concrete provider integration deferred/unverified. This is consistent with the master specification's prohibition on provider-specific logic in Logistics core.

### Additional L21 dependency audit — existing provider execution path

The provider stack is not absent. It is deliberately split across existing generic boundaries:

| Phase | Existing component | Verified responsibility | Not provided by that component |
|---|---|---|---|
| 16.3 / 16.4 | Platform Adapter + Integration framework | Canonical capability/integration/adapter registry and boundary validation | Provider credentials, provider transport, persistent provider registry |
| 16.13.3 | Logistics Provider Adapter contract | Declares provider type/operations and delegates to `logistics.operations` | Provider selection, credentials, transport, persistence |
| 16.13.11 | Logistics Network Integration contract | Composes provider/integration/adapter references, direction and operations | Live provider connection or provider-owned state |
| 16.13.12–.14 | Execution bridge + server execution service | Injected provider invocation, result normalization/reliability, existing canonical application path | Provider transport client, credential storage, retry engine |
| 16.13.15–.16 | Runtime + deployment adapter binding | Binds deployment-supplied executor to active Platform Adapter in process memory | Production transport or durable provider configuration |
| 16.13.18–.19 | Callback normalization/application | Normalizes authenticated callback data and applies only supported canonical result | HTTP ingress/authentication, callback store |

The current canonical application is intentionally narrow: `fulfillment_delivered` can transition through the existing `transitionOrderFulfillment` authority. Other result types remain evidence-only or require existing tracking/proof/exception/return mutation authorities that are not invented by this adapter stack. This means provider execution is a reusable composition path with limited canonical mutation coverage—not a complete carrier integration.

**Correct L21 status:** generic integration/adapter/execution composition is implemented; deployment-supplied executor binding is implemented; a production provider-specific transport/configuration and full callback ingress remain unverified/not implemented. Preserve the existing stack and extend it only for a concrete, authorized provider use case. Do not build another provider registry, credential store, callback store, routing engine, retry engine, or Logistics authority.

### Phase 16.13 provider regression CI gap — correction applied

A current-main workflow audit confirmed that none of the five GitHub workflow files executed the Phase 16.13 provider-stack regressions. The existing `test:phase16.13` command is a Node >=24 gate plus Phase 16.12 platform regression; it does not execute Phase 16.13 provider tests. The repository contains 18 distinct Phase 16.13 provider regression files (.1–.16, .18, .19), while package scripts exposed only .10–.19; the .17 alias duplicates .13.

**Correction applied:**
- Added `phase0/phase16.13-logistics-provider-cumulative-regression.mjs`, which executes all 18 distinct provider regression files sequentially in separate Node processes and enforces Node >=24.
- Added root script `test:phase16.13-logistics-provider`.
- Added that single cumulative command to `.github/workflows/logistics-runtime-certification.yml`.
- The .17 alias remains for compatibility but is deliberately not executed as a separate test because it resolves to the .13 file.

**Verification:** Logistics Runtime Certification run [44933362910](https://github.com/T-BOT-tech/sellify/actions/runs/44933362910) passed on commit `c17256573cc75dd3af624c7c173d74678bc61488`, under Node v24.22.3. All 18 distinct provider regressions passed in sequence:
- .1–.7: network contract, capability, adapter, discovery, verification, selection and handoff.
- .8–.12: result normalization, reliability, matching, network integration and execution bridge.
- .13–.16: canonical application, server execution service, runtime binding and deployment adapter.
- .18–.19: callback normalization and callback application.
The .17 alias was deliberately excluded as a duplicate of .13.

Enabling the suite exposed stale regression assertions and one genuine boundary omission. The tests were corrected to match actual contract semantics (evidence required for delivered/returned results, synchronous throw assertions, current callback version 1.1, canonical result property, and correct provider fixture/error expectations). The L7 network integration contract was hardened to reject credentials and ownership claims rather than silently ignoring those supplied fields. No Logistics authority or external transport implementation was added.

The root package manifest changed to register the cumulative gate. The Phase 21.16 source-hash manifest's `package.json` digest was refreshed to the exact SHA-256 reported by the Node 24 Phase 21.16 regression; the Phase 21 capacity evidence job passed on the same commit. This preserves the hash check rather than bypassing it.

This is test/certification wiring plus a narrow integration-input hardening correction. It does not add provider transport, credential storage, a provider registry, retry/callback persistence, or new domain authority.

### Corrected overall conclusion

| Layer | Master-spec requirements | Current evidence | Status |
|---|---|---|---|
| L11 Scheduling | Four modes; initial Regional Freight/B2B applicability; coordination only | Contract, persistence, service, auth, feasibility, lifecycle, HTTP and UI tests | Shared capability implemented; dedicated service-profile journey coverage not separately verified |
| L20 Intelligence | Seven derived metrics; after real operational data; no transaction authority | Contract + regression cover all seven metrics and non-authority | Contract implemented; live operational-data integration not verified |
| L21 External network | Reuse Canonical Contract → Integration → Adapter → Provider; no provider-specific Logistics core | Generic integration/adapter/execution composition + 18 Phase 16.13 regressions; no production provider transport/configuration | Partially implemented; production provider integration not verified |

No test aliases or source code were deleted. The next correct step is not to invent L11/L20/L21 subphase tests. It is to validate the real-data dependency for L20 and determine which existing Integration/Adapter/provider can be extended for L21, while preserving the Logistics core's provider-neutral boundary.

## Consolidated disposition

| Area | Real regression targets | Alias family | Evidence judgment |
|---|---:|---:|---|
| Logistics L11 | 7 identified phase tests (.1, .3–.8) | L11.8 + L11.9–.16 share one target | Earlier subphase acceptance mapping incomplete |
| Logistics L20 | 1 | 10 names share one target | Seven metric families tested; individual .2–.10 unverified |
| Logistics L21 | 1 | 11 names share one target | Broad boundary test; no live provider adapter |
| Procurement 17.3 | 2 | 2 names per target | Two distinct regressions exist |
| Procurement 17.4 | 2 | 2 names per target | Two distinct regressions exist |

No tests or aliases were deleted. The next evidence task is to retrieve and map the approved Logistics master specification's actual L11.2/L11.9–L11.16/L20.2–L20.10/L21.2–L21.11 requirements. If that specification has no such subphase definitions, the correct remediation is to correct phase evidence labeling—not invent additional implementation or tests.

## Phase 16.13.17 alias anomaly (source inspection)

The recursive current-main tree contains `phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs`, followed by distinct `.14`, `.15`, `.16`, `.18`, and `.19` regression files. There is no tracked `phase16.13.17` regression file.

Both `test:phase16.13.13` and `test:phase16.13.17` currently invoke the `.13` canonical-application regression. The inspected `phase0/phase16.13-node24-certification.mjs` checks the Phase 16.12/16.13 certification artifacts and runtime, but does not require either alias. The `.17` name therefore appears to be a mislabelled compatibility alias or stale script entry—not evidence of a separate Phase 16.13.17 test.

**Disposition:** keep both names for now. The complete repository documentation/local/external consumer check has not yet established that the `.17` alias can be safely removed. Do not invent a `.17` regression file merely to make the naming sequence continuous; first verify whether Phase 16.13.17 has a separate acceptance requirement and, if so, map it to the correct existing behavior or add a genuinely distinct test.

## Logistics L8-L21 cumulative execution: actual gate semantics

The current `phase0/logistics-l8-l21-cumulative-exit-gate.mjs` was read in full. It directly executes **14 distinct regression files** in order: L8, L9, L8-L10, L11, then L12 through L21. It invokes each file with the current Node executable using `execFileSync`; it does not rely on repeatedly invoking the alias families in `package.json`.

Consequences for the alias inventory:

- The L11 alias family has one independently executed L11 scheduling regression in the cumulative gate. Its header identifies it as L11.8; the extra L11.9–L11.16 script names are not independent test executions.
- L20's cumulative gate entry runs the single L20 network/corridor intelligence regression once. The L20.1–L20.10 package aliases are not ten independent tests.
- L21's cumulative gate entry runs the single L21 external-network expansion regression once. The L21.1–L21.11 package aliases are not eleven independent tests.
- The source-level master-specification exit audit separately requires the package aliases `test:logistics-l20.10` and `test:logistics-l21.11`, and the runtime final-certification gate checks those names exist before invoking the cumulative gate. These names are therefore acceptance identifiers, not evidence of separate test files.

The cumulative gate is a valid execution orchestrator for the 14 files it declares. This audit does **not** establish that every named subphase from L11.9–L11.16, L20.2–L20.10, or L21.2–L21.11 has separately scoped acceptance assertions. Do not represent the aliases as separate coverage. If the master specification requires per-subphase acceptance, the gap is in explicit acceptance mapping/assertions—not in the number of package script names.

## Transitive-consumer spot audit and CI closure (2026-11-21)

### Current-main verification

The target-inventory commit `c88a5e55f8e18717aa08ed8fdbbbb2d769535f95` is now the current `main` head. All four required GitHub workflows completed successfully for that exact SHA:

- Sellify CI: success — [run 44931058681](https://github.com/T-BOT-tech/sellify/actions/runs/44931058681)
- Repository Security Checks: success — [run 44931058362](https://github.com/T-BOT-tech/sellify/actions/runs/44931058362)
- Sellify Release Certification: success — [run 44931058401](https://github.com/T-BOT-tech/sellify/actions/runs/44931058401)
- Logistics Runtime Certification: success — [run 44931058467](https://github.com/T-BOT-tech/sellify/actions/runs/44931058467)

The preceding Sellify CI run for `65d4bdd` also completed successfully after the earlier in-progress baseline job finished.

### Confirmed script-name consumers

A source-level spot audit confirms that several aliases are consumed by executable acceptance controls, not merely developer convenience:

| Script name(s) | Confirmed consumer | Disposition |
|---|---|---|
| `test:gap-2-delivery-lifecycle`, `test:gap-2-delivery-exception` | `phase0/gap-2-production-readiness-regression.mjs` requires both package aliases and verifies CI invokes one of them; GAP-2 source-of-truth doc also lists both | Preserve both |
| `test:logistics-l20.10`, `test:logistics-l21.11` | `phase0/logistics-master-specification-exit-audit.mjs` and `phase0/logistics-l8-l21-final-certification.mjs` | Preserve |
| `test:logistics-l8-l21` | `phase0/logistics-l8-l21-final-certification.mjs` invokes it as the actual cumulative run | Preserve |
| `phase11.4:marketplace-test` | Current AI handoff history and CI workflow use the canonical Phase 11.4 alias; the Phase 13.10.24 compatibility name maps to the same regression | Preserve compatibility name until all consumers are reconciled |
| `dev:backend` | Root README and UI evaluation environment documentation use it as the backend developer entry point | Preserve |
| `dev` | Same command as `dev:backend`, but no distinct operational behavior established in this spot audit | Candidate compatibility alias only; not approved for removal |

The Logistics certification files intentionally assert the presence of phase-labeled script names even when multiple labels resolve to a shared regression target. These names represent evidence/acceptance identifiers, not necessarily distinct test programs. Removing them because they share a target would break the source-level acceptance contract.

The marketplace, procurement, Phase 16.13, Logistics L11/L20/L21, and developer aliases still require complete consumer reconciliation before any deletion. Search-index results are useful for discovery but are not treated as exhaustive proof of absence. Historical documentation and source-level controls remain relevant consumers.

### Decision

- **No package aliases deleted in this batch.**
- **No regression files or CI invocations removed.**
- The one obvious exact alias pair `dev` / `dev:backend` is a cleanup candidate, not yet a deletion: `dev:backend` is documented and should remain the canonical developer command; before removing `dev`, check all repository-local references and any external developer scripts.
- Next scope: complete the remaining alias-by-alias consumer map, then separately map all 481 scripts to their phase acceptance records and classify genuinely redundant labels. Do not conflate alias cleanup with test coverage reduction.

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


## L20 operational-source trace and CI closure (2026-11-21)

### CI closure on current audited main

Sellify CI run [44933449936](https://github.com/T-BOT-tech/sellify/actions/runs/44933449936) completed successfully on the current audited main revision. All five jobs passed:

- `baseline (24)`
- `logistics_l18 (24)`
- `phase13_10_24 (24)`
- `phase21_capacity_evidence`
- `logistics_exit_certification`

The separate Repository Security Checks run `44933449941`, Logistics Runtime Certification run `44933449932`, and Sellify Release Certification run `44933449929` also passed for the audited revision. This closes the previously pending baseline job; it does not imply production-provider integration or live L20 data coverage.

### Existing operational source records found

The repository already has canonical operational data suitable for a future read-only L20 source adapter. These are not new proposed authorities:

| L20 signal input | Existing canonical source | Evidence and limitation |
|---|---|---|
| Demand / fulfilled demand | Core `orders` and `fulfillments` | Core Fulfillment reads canonical orders and stores fulfillment type/status, location, scheduled time, tracking reference, proof and version in the existing `fulfillments` table. Order/fulfillment records can support observed demand and completed quantity only after their counting semantics and time window are specified. |
| Delivery completion / exception evidence | `delivery_assignments`, `fulfillments`, `audit_events` | Assignment lifecycle writes canonical assignment state and audit actions such as `delivery.assignment.created`, `delivery.assignment.delivered`, `delivery.assignment.reassigned`, and exception resolution. Core fulfillment transitions also write `fulfillment.transitioned`. Audit events are audit evidence, not a replacement event store or a ready-made analytics feed. |
| Depot throughput / inventory consequence | Existing `inventory_movements` and warehouse/inventory authorities | Terminal Core Fulfillment can atomically write existing SALE inventory movements, linked to fulfillment/order metadata. This measures an inventory consequence, not by itself depot handling throughput; counting rules must avoid treating one sale movement as one physical parcel or depot operation. |
| Recurring / scheduled demand | Existing `logistics_scheduling_activities` linked to order, fulfillment and movement IDs | Scheduling persists requested/scheduled windows, recurrence, status, and canonical related references. It is coordination data; it must not be counted as confirmed demand or completed delivery without explicit lifecycle semantics. |
| Provider capacity visibility | Existing capacity/provider capability and verification records | Provider capability/discovery/verification and capacity-profile contracts exist. Their presence does not establish fresh, time-stamped, provider-reported capacity observations for a corridor. |

### Existing event boundaries are not yet an L20 feed

- `app/src/events/event-boundary.js` creates versioned event envelopes and adapts them to the existing outbox.
- `app/src/sync/outbox.js#enqueueEvent` remains the client outbox authority.
- The current backend sync-event consumer in `backend/lib/store-sqlite.js#processSyncEvent` accepts `inventory.movement.record` and `customer.upsert`; unsupported event types fail closed. The Phase 13.12.14 regression explicitly asserts this supported list.
- Core fulfillment and delivery-assignment mutations write canonical tables and audit events transactionally. The inspected code does not route those lifecycle actions through a Logistics operational-event consumer feeding L20.
- `app/src/verticals/logistics/network-corridor-intelligence-contract.js` accepts already-formed observation objects and derives seven metrics. It does not query Orders, Fulfillment, Delivery Assignments, audit events, inventory movements, scheduling records, or provider capacity sources. Its regression constructs observations directly in the test.

### Correct status and next implementation boundary

**L20 status: metric contract implemented; canonical operational source records exist; source-to-observation integration is missing/unverified.** Do not mark L20 as live-data integrated.

The next bounded implementation task is a source-mapping/design pass over the canonical records above, then a read-only, organization-scoped observation builder only after metric definitions are made explicit (time window, units, deduplication, cancellation/exception handling, status inclusion, corridor/location mapping, and freshness). It must not persist a second operational ledger, mutate orders/fulfillment/inventory, infer provider capacity without provider evidence, or introduce a new event store. Prefer direct read projections over adding a new event type unless an existing canonical event contract is shown to be the right extension point.

No production code was changed in this L20 source-trace batch. The change is an evidence update only.


### Capacity and corridor evidence precision check

A follow-up schema inspection narrows the capacity conclusion:

- The only matching durable capacity-signal table found in `backend/lib/store-sqlite.js` is `supplier_network_capacity_signals`. Its schema restricts `source` to `DECLARED`; it is Supplier Network product/capability availability, not observed logistics-carrier capacity for a corridor.
- Logistics scheduling records carry organization/location and related order/fulfillment/movement references, but the inspected scheduling schema has no corridor identifier. A corridor mapping cannot be assumed from a location ID.
- The Logistics capacity-profile, provider-capability, discovery and verification modules are contracts/projections; this audit did not find a corresponding durable Logistics provider-capacity observation table or a live provider telemetry feed.

Therefore, provider-capacity visibility for L20 remains **unavailable from verified live source data**. Supplier Network declared capacity must not be silently repurposed as verified carrier capacity. A corridor/location mapping and an evidence freshness/source contract are prerequisites for any future read-only observation builder.


A final persistence search also found no `corridor` or `corridor_ref` column/table in the backend SQLite schema. Core `locations` are organization-scoped and have a code/name/type/status, but no corridor geometry in the inspected schema. Supplier Network service-area records do support geo codes and optional radius coordinates, but they belong to Supplier Network and are not automatically Logistics corridor definitions. Do not borrow that authority or infer a corridor from a location without an explicit canonical mapping.


## L20 metric-semantic and regression-coverage audit (2026-11-21)

The L20.1 contract and its regression were inspected function-by-function. The seven metric names are present and calculation functions exist, but the current observation shape is a collection of caller-supplied integer counters. It does not yet define enough provenance, units, time boundaries, or entity relationships to support operational decisions.

### Implemented calculation behavior

| Metric | Current implementation | What it does not establish |
|---|---|---|
| Corridor demand | Sums `demand_count`; also sums `fulfilled_count` and derives unmet demand / fulfillment rate | Demand unit (orders, loads, parcels, weight), time window, cancellation treatment, or whether observations overlap |
| Backhaul opportunity | Sums `backhaul_count`; reports AVAILABLE if the sum is positive | Directional origin/destination, return-leg timing, compatible cargo/vehicle, provider availability, or an actual matchable empty leg |
| Depot throughput | Sums `throughput_count`; compares it with summed demand | Depot identity, throughput unit, handling milestone, time window, or whether one item represents a parcel, load, scan, or inventory movement |
| Capacity shortage | Sums `shortage_count`; also flags shortage when demand exceeds fulfilled demand | Whether shortage means unavailable eligible capacity versus unfulfilled demand; capacity unit, vehicle compatibility, time window, or independent shortage evidence |
| Service-area gap | Sums `service_area_gap_count`; reports a gap if positive | Geographic cell/service-area identity, coverage denominator, attempted/eligible demand, location mapping, or distance/coverage policy |
| Recurring demand | Sums `recurring_demand_count` | Recurrence identity, interval/frequency, number of periods observed, missed/fulfilled recurrence, or duplicate scheduled instances |
| Provider-capacity visibility | Sums `capacity_count`; reports CAPACITY_VISIBLE when positive | Provider identity, capacity unit, source, observation time/freshness, corridor assignment, availability window, verification, or whether the capacity is provider-declared versus live-observed |

### Cross-cutting contract gaps

1. **No observation time/window.** The normalized observation has no `observed_at`, `period_start`, or `period_end`. Therefore metrics cannot distinguish current capacity from stale capacity or compare demand over equivalent periods.
2. **No source provenance.** The observation does not carry a source record/type, source authority reference, evidence reference, or source quality/freshness. The constant `source_authority: existing_operational_domain_data` is a declaration, not evidence that a given counter came from a canonical record.
3. **No units.** All seven measures are unqualified integers. Adding orders, parcels, vehicle slots, tonnes, and depot scans would produce meaningless totals if they were supplied under the same count fields.
4. **No deduplication.** `observation_ref` is required but repeated references are accepted and summed. The same canonical order, assignment, schedule occurrence, provider capacity record, or depot event can therefore be counted more than once.
5. **No corridor identity proof.** `corridor_ref` is any non-empty string. The repository schema inspected in this audit has no canonical Logistics corridor registry or mapping that validates it.
6. **No metric-specific entity keys.** There is no depot ID, provider ID, service-area ID, route direction, vehicle/capacity class, or recurrence key. Aggregation can therefore combine unrelated entities under the same organization/corridor/service profile.
7. **No cross-signal provenance/version validation.** Snapshot composition checks organization, corridor and service profile, but does not validate that all signals share the same contract version or observation period.
8. **Zero-demand rate semantics.** Both single-observation and aggregated demand functions return a fulfillment rate of `1` when demand is zero. This represents a 100% rate despite there being no demand denominator; a future product contract should represent this as not-applicable/undefined rather than imply measured perfect fulfillment.

### Regression coverage assessment

The L20.1 regression verifies arithmetic, organization/corridor/service-profile scope conflicts, authority-boundary flags, and selected invalid numeric values. It uses hand-authored observations such as `ADDIS-DEPOT-01`; it does not test canonical source extraction, source freshness, period alignment, duplicate observation references, unit compatibility, entity-level aggregation, or corridor-reference validation.

### Status decision

**L20 metric calculations: implemented as a preliminary pure contract. L20 operational metric semantics: partial. L20 live-data integration: missing/unverified. L20 production decision-readiness: not established.**

Do not add a source adapter or builder against the current counter-only shape. First agree a metric dictionary with unit, grain/entity key, event/status inclusion, period/window, deduplication key, provenance/freshness, and missing-data semantics for each metric. Then validate that existing canonical records can actually supply those fields. If a required source field or corridor mapping does not exist, expose the metric as unavailable rather than fabricate a value or create a competing domain authority.

No production code or regression behavior was changed in this audit. This is a source-backed readiness finding, not a certification of operational accuracy.


## L21 external-network production-readiness audit (2026-11-21)

The L21 contract, regression, shared Platform Integration/Adapter framework, Logistics provider execution bridge, deployment binding, callback normalization, and canonical application boundary were inspected. This confirms substantial **contract and composition scaffolding**, but not a deployable external logistics integration.

### What exists

| Layer | Verified implementation | Boundary / limitation |
|---|---|---|
| L21 network contract | `app/src/verticals/logistics/external-network-expansion-contract.js` normalizes integration identity, organization scope, service profile, direction, declared capabilities, requests/responses, inbound messages, evidence reconciliation, retry classification and canonical handoff dispositions | Pure contract logic; it does not connect to a real carrier or persist operational observations |
| Generic integration | `app/src/verticals/logistics/network-integration-contract.js` composes the existing Platform Integration contract using `logistics.operations` | No Logistics-owned provider registry, credential store, persistence, routing, or shipment ledger |
| Adapter boundary | `app/src/platform/adapter-framework.js` resolves a capability to its existing authority and holds process-local adapter metadata / executor delegates | No production transport client or durable provider registration |
| Deployment binding | `backend/lib/logistics/provider-deployment-adapter.js` and `provider-execution-runtime.js` bind a deployment-supplied executor to an active existing adapter | Executor is injected and process-local; no provider-specific implementation, secret resolution, or deployment configuration is supplied here |
| Server execution | `backend/lib/logistics/provider-execution-service.js` composes authorized handoff, adapter execution, result normalization/reliability, and canonical application | External provider invocation remains injected; timeout is present, but no durable retry/queue or transport lifecycle is implemented |
| Callback boundary | `app/src/verticals/logistics/provider-callback-contract.js` normalizes an already-authenticated callback | HTTP ingress, signature/authentication verification, durable callback receipt, and replay persistence are deployment responsibilities and are not implemented by this contract |
| Canonical application | `backend/lib/logistics/provider-execution-application.js` delegates to existing `transitionOrderFulfillment` in `backend/lib/store-sqlite.js` | Only `fulfillment_delivered` for the `delivery` operation is executable; accepted/in-progress/tracking/proof/failed/returned outcomes do not have an implemented canonical application path in this bridge |

### Regression coverage and its limits

The L21 regression `phase0/logistics-external-network-expansion-regression.mjs` exercises contract normalization and boundary rules for integration scope, lifecycle transitions, adapter trust/capabilities, request/response envelopes, inbound messages, evidence reconciliation, canonical handoff, and retry disposition. The eleven `test:logistics-l21.*` package names all resolve to this same regression file; they are not eleven independently executed provider integrations.

The regression uses synthetic integration and message references. It demonstrates that the contracts reject selected invalid inputs and preserve declared authority boundaries. It does **not** demonstrate:
- a real carrier/3PL API request or authenticated connection;
- secure credential retrieval/rotation or provider-specific request signing;
- deployed callback/webhook ingress, authentication, replay protection, or durable deduplication;
- provider-specific request/response mapping against a sandbox or production API;
- durable retries, backoff, dead-letter handling, or recovery after process restart;
- live tracking, proof, capacity, or status synchronization;
- canonical application of provider outcomes other than the supported delivered transition.

### Status decision

**L21 contract and boundary logic: implemented. Shared adapter/execution composition: implemented as injected, process-local deployment wiring. Production provider transport/configuration: missing or unverified. Callback ingress and durable replay handling: missing or deployment-external. Canonical result application: partial, with delivered-only execution. End-to-end production integration: not established.**

Do not create another provider framework, Logistics registry, credential store, callback store, retry engine, shipment ledger, or fulfillment authority. The existing Phase 16.13 stack is the intended execution composition. A concrete integration should proceed only after a provider is selected and its API/authentication contract, operation mapping, callback behavior, sandbox, deployment/secret boundary, retry semantics, and canonical result mapping are evidenced. Before enabling it for organizations, run a provider-specific adapter contract suite and an end-to-end sandbox test through the existing server execution service and canonical transaction.

This is a source-backed readiness assessment, not a claim that L21 production connectivity or live provider operations are certified.

## L21 cross-layer fulfillment-authority naming reconciliation (2026-11-21)

A follow-up trace compared the older app-side Logistics fulfillment contracts with the newer Phase 16.13 server execution and callback composition.

### What the source actually does

- `app/src/logistics/fulfillment.js` is a frontend/API binding. Its own header says the UI expresses intent and the backend Core Fulfillment API owns status transitions and terminal inventory consequences. It sends authenticated requests to the backend and projects canonical responses; it is not itself the durable server mutation authority.
- `backend/lib/logistics/provider-execution-application.js` calls the existing `transitionOrderFulfillment` transaction from `backend/lib/store-sqlite.js`. Its contract correctly names `backend/lib/store-sqlite.js` as the fulfillment authority and supports only the delivered transition through this provider bridge.
- The newer Phase 16.13 server service, runtime, deployment adapter, and callback application consistently identify the backend store as the server-side mutation authority.
- However, older cross-pack and provider-side projection contracts (including `provider-execution-result-contract.js` and `provider-execution-bridge-contract.js`) label `app/src/logistics/fulfillment.js` as `fulfillment_authority` or `mutation_authority`. Their regressions assert that literal path. That label is ambiguous: it describes the frontend integration binding, not the backend transaction that actually commits fulfillment state.

### Classification

This is a **cross-layer authority metadata / naming inconsistency**, not evidence of a second fulfillment implementation. The frontend module explicitly delegates mutation to the backend, and the Phase 16.13 server path explicitly delegates canonical mutation to the existing SQLite-backed Core Fulfillment transaction.

Do not mechanically replace every `app/src/logistics/fulfillment.js` reference. Some are accurate descriptions of the UI/API boundary, and changing all of them would blur rather than clarify ownership. The next safe correction is a scoped contract vocabulary review: distinguish `fulfillment_api_client` or `frontend_fulfillment_binding` from `server_fulfillment_mutation_authority`, update only contracts whose field currently claims server mutation ownership, and revise their source-level regressions together. Preserve the existing API flow and canonical transaction.

No production code or tests were changed in this follow-up. This is a source-backed audit finding.

## L21 fulfillment mutation metadata correction (2026-11-21)

The source-consumer audit established that not every `fulfillment_authority: app/src/logistics/fulfillment.js` field is wrong. In the older cross-pack contracts it can denote the established frontend/API lifecycle binding. Replacing all such references would erase a useful boundary distinction and could break unrelated compatibility contracts.

A narrower correction was applied only where the field explicitly claimed `mutation_authority`:

- `app/src/verticals/logistics/fulfillment-boundary.js`
- `app/src/logistics/unified-fulfillment-contract.js`
- `app/src/verticals/agriculture/warehouse-logistics-contract.js`
- `app/src/verticals/physical-commerce/spine-contract.js`

Those projections now retain the frontend binding as `frontend_fulfillment_api_binding: app/src/logistics/fulfillment.js` and identify `backend/lib/store-sqlite.js` as `mutation_authority` / `server_fulfillment_mutation_authority`. The Physical Commerce spine's nested `logistics.lifecycle_mutation_authority` is also explicitly mapped to the backend store; its frontend binding remains separately recorded under `fulfillment.frontend_fulfillment_api_binding`. Existing logical `fulfillment_authority` fields were preserved where they describe the established frontend integration binding. No route, lifecycle, transaction, inventory, provider, or persistence behavior changed.

The four corresponding focused regressions were updated, including an explicit assertion for the nested Physical Commerce lifecycle mutation field:

- `phase0/phase13.10.3-logistics-fulfillment-boundary-regression.mjs`
- `phase0/phase13.11.9-unified-fulfillment-regression.mjs`
- `phase0/phase13.11.7-agriculture-warehouse-logistics-regression.mjs`
- `phase0/phase13.11.3-physical-commerce-spine-regression.mjs`

All eight updated files were fetched again from the default branch and checked for the new backend mutation authority and explicit frontend binding fields. This is source-level verification only; runtime regression execution and CI status must be checked separately. The GitHub contents API produced one commit per file; all eight resulting blobs were verified present on the default branch after the final commit.

## L21 Phase 13.11 integrity-manifest maintenance (2026-11-21)

The fulfillment metadata correction changed files covered by the existing Phase 13.11 SHA-256 controls. The affected manifests were refreshed rather than leaving known-stale expected hashes:

- `phase0/PHASE13.11.3-SOURCE-HASHES.sha256`
- `phase0/PHASE13.11.7-SOURCE-HASHES.sha256`
- `phase0/PHASE13.11.9-SOURCE-HASHES.sha256`
- `phase0/PHASE13.11.20-SOURCE-HASHES.sha256`
- `phase0/PHASE13.11.21-SOURCE-HASHES.sha256`

The refreshed entries cover the modified Phase 13.11.3, 13.11.7, and 13.11.9 source/regression files, their nested manifests, and the current root `package.json` hash where included. The Phase 13.11.20 and 13.11.21 manifest entries were checked against the fetched source contents for the affected files. No acceptance condition, expected test result, Node requirement, or hash-verification logic was weakened.

This is manifest maintenance, not runtime evidence. The Phase 13.11.19 cumulative gate, Phase 13.11.20 documentation-hash regression, Phase 13.11.21 snapshot-exit regression, and the four focused fulfillment regressions still require execution under Node >=24. GitHub status queries for the latest commit returned no status checks, and the available repository connection does not expose a workflow-dispatch or push-run listing action. Do not mark the gates PASS until actual execution results are available.

## Phase 13.11 CI coverage reconciliation (2026-11-21)

The current `.github/workflows/ci.yml` baseline job did not directly invoke the Phase 13.11.19 cumulative gate or the Phase 13.11.20 / 13.11.21 integrity and snapshot regressions. Later Phase 16 and Phase 13.12 checks do not transitively execute these three controls: Phase 16.12 executes Phase 16.0–16.11 and Golden Regression; Phase 16.13 wraps Phase 16.12; Phase 13.12.15 references the Phase 13.11.21 snapshot as a historical artifact but is not itself part of the current CI workflow.

Added the following ordered steps to the existing `phase13_10_24` job in `.github/workflows/ci.yml` (which runs on the Node 24 matrix):

- `npm run test:phase13.11.19` — cross-pack cumulative regression gate (includes the Phase 13.11.3, .7 and .9 regressions and the other listed Phase 13.11 controls).
- `npm run test:phase13.11.20` — documentation and source-hash integrity regression.
- `npm run test:phase13.11.21` — final snapshot and exit regression.

This is a CI coverage correction only. It does not change application behavior, canonical authority, package scripts, hash manifests, or Phase 13.11 acceptance conditions. The workflow edit is committed as `769c756b2886fb899363e055fbc6ef7fb82da95b`.

Runtime execution and resulting GitHub Actions status are still pending verification. Do not report these checks as passing until the updated workflow has run successfully under Node 24.

## Phase 13.11 linked-manifest verification hardening (2026-11-21)

A follow-up inspection found that the Phase 13.11.19 source-hash manifest had no verifier in its own cumulative gate. The later .20 and .21 manifests already carried a hash entry for the .19 manifest, but the three entries inside the .19 manifest were not checked by an executable control.

Corrected this without changing the controlled file set or any Phase 13.11 acceptance result:

- `phase0/phase13.11.19-cumulative-gate.mjs` now reads `PHASE13.11.19-SOURCE-HASHES.sha256`, validates each entry's format and file existence, and verifies each SHA-256 value before executing the cumulative regressions.
- The .19 manifest retains three controlled entries: its cumulative-gate script, its phase document, and root `package.json`.
- `PHASE13.11.20-SOURCE-HASHES.sha256` continues to include the .19 manifest and the updated .19 gate.
- `PHASE13.11.21-SOURCE-HASHES.sha256` now also includes the .20 manifest itself. The .21 regression explicitly requires that link before validating the final snapshot manifest.
- Refreshed the .19, .20 and .21 linked hashes after each source/manifest change. The .20 and .21 manifests contain 81 and 86 entries respectively.

During this review, the newly added .19 manifest parser was found to have an over-escaped newline regular expression. It was corrected to split actual LF/CRLF lines before the hash-entry checks. The affected source hash and downstream manifest links were refreshed again after that correction.

This is source-level integrity hardening only. It does not alter application behavior, canonical domain ownership, or the Node `>=24` requirement. The changed manifest entries and linkage were checked against fetched source contents; the complete .20/.21 manifest verification and cumulative regression execution still need to run in CI under Node 24. Do not treat the phase as newly runtime-certified until those checks complete.



## CI baseline job audit and redundant browser setup removal (2026-11-21)

- Reviewed `.github/workflows/ci.yml` baseline job before considering any job split.
- The baseline job contains 182 named steps and 180 `run` commands, spanning core/offline/database, onboarding, Service Booking, Payment, Procurement, Inventory/Fulfillment, Marketplace/Telegram, Logistics, FUX/IAM/UI, and country/discovery/cross-border checks. Category counts overlap because some checks span multiple domains.
- The job installs Chromium system dependencies and the Chromium browser before the outbox browser regression. A later full-app browser smoke step repeated `npx playwright install --with-deps chromium` in the same job. Removed only that redundant later installation; the existing `install-deps` and browser installation steps remain, and both browser regressions remain.
- Workflow change: `0d70bb7c143fdc290a888caaec30dde0fbd7e9a3`.
- Re-fetched workflow verification confirms exactly the two intended Playwright setup commands remain in `baseline`; no browser test or assertion was removed.
- CI status and PR workflow-run query returned no checks/runs for this commit. Runtime/CI validation is therefore pending; do not treat the optimization as CI-certified.
- No job restructuring was made. The baseline is broad, but splitting it now would add runner/dependency setup and risks overlapping existing cumulative gates. First map each test's standalone versus nested-gate role and identify natural parallel groups without repeating execution.


## CI baseline nested-gate duplicate execution cleanup (2026-11-21)

A source-level execution trace identified 18 baseline steps that repeated regressions already executed by retained cumulative gates:

- 17 direct Phase 17.1–17.9 steps repeated files enumerated by `phase0/phase17.10-cumulative-exit-gate.mjs`. That gate verifies an exact 19-file Phase 17.1–17.9 regression inventory, executes all 19 files in separate Node processes, then executes Phase 16.12 and Golden Regression. The workflow retains `npm run test:phase17.10` as the single Phase 17 execution entry point.
- The standalone Phase 14.3 country currency/money regression repeated a member of the ordered Phase 14.0–14.12 suite executed by `phase0/phase14.13-cross-country-regression.mjs`. The workflow retains `npm run test:phase14.13`.

Removed those 18 standalone workflow steps from `baseline`; no regression file, package script, test assertion, or cumulative gate was deleted or modified. The cumulative gates continue to execute the underlying regressions, and their failure output identifies the failing file/check. This trades separate per-test GitHub Actions step labels for one cumulative step per gate while avoiding a second execution of the same tests.

Workflow change: `460b93abcb994d11dae059d32b686c4fe07baeb6`. Re-fetched workflow verification confirms no standalone Phase 17.1–17.9 steps remain, the Phase 17.10 gate remains, the standalone Phase 14.3 step is absent, and the Phase 14.13 gate remains. Runtime/CI status has not yet been established for this change; do not claim the revised workflow has passed.

Other intentional overlaps remain unchanged: Golden Regression is also run as an independent baseline check, and Logistics L1–L7 cumulative certification remains separately visible in its dedicated Logistics job even though Phase 13.11.19 invokes the same cumulative Logistics gate. These are retained for independent failure/certification visibility, not treated as accidental duplication.


## Phase 16 / 19 / 20 cumulative-gate overlap audit (2026-11-21)

Reviewed the baseline job's retained `test:phase16.14`, `test:phase19.12-cumulative`, and `test:phase20.12` commands and traced their nested execution paths:

- Phase 16.14 invokes Phase 16.13; Phase 16.13 invokes the full Phase 16.12 platform regression; Phase 16.12 invokes all 12 Phase 16 controls and Golden Regression. This is required preflight for the final platform snapshot and Node >=24 certification. Do not remove it from Phase 16.14.
- Phase 17.10 independently runs the 19-file Phase 17 suite, Phase 16.12, and Golden Regression.
- Phase 19.12 cumulative independently runs Phase 19.2–19.12, Phase 18.12 structural exit, Phase 16.12, and Golden Regression. Its explicit output/report records those prerequisite checks.
- Phase 20.12 independently runs Phase 20.1–20.11, the Phase 19.12 full ecosystem discovery exit regression, Phase 16.12, and Golden Regression. Its Phase 19 prerequisite is the final discovery exit regression, not the Phase 19.12 cumulative gate.

Therefore the Phase 16.12 and Golden checks repeat across the Phase 16.14, Phase 17.10, Phase 19.12, and Phase 20.12 high-level gates (plus Golden's standalone baseline step). These are deliberate self-contained cumulative certification gates: each phase exit can be invoked independently and validates its own prerequisite boundary. Removing nested checks or making gates depend on prior workflow steps would weaken standalone reproducibility and make phase certification dependent on workflow ordering. No source/workflow change is recommended for these overlaps.

Phase 19.12 and Phase 20.12 are separate cumulative gates with distinct phase coverage. Phase 20.12 does not invoke the Phase 19.12 cumulative gate; it runs the Phase 19.12 full ecosystem exit regression as a prerequisite. Do not label this as a duplicate cumulative-gate invocation.

Decision: retain the repeated prerequisite executions. The earlier 18-step Phase 17 / Phase 14.3 cleanup remains safe because those were direct workflow invocations duplicating tests already run by a retained gate in the same baseline job, without an independent top-level certification purpose. Current CI status for the workflow consolidation commits remains unverified.


## Cross-job capacity-evidence execution audit (2026-11-21)

Inspected the dedicated `phase21_capacity_evidence` job against the Phase 19 and Phase 21 cumulative gates:

- `test:phase21.14` executes the Phase 21.3 capacity/availability evidence regression as one of its 14 constituent checks (and asserts its expected 18 PASS count).
- The workflow also invoked `test:phase21.3` directly immediately before `test:phase21.14` in the same job. This was an exact duplicate execution with no separate certification boundary. Removed only that direct workflow step; Phase 21.3 remains executed and counted by the Phase 21.14 cumulative gate.
- `phase18.5-supplier-network-capacity-regression.mjs` remains a distinct backend persistence/authority test; it is not the Phase 21.3 projection test.
- `phase21.17-capacity-evidence-migration-regression.mjs` remains a distinct migration test exercising fresh, full-legacy, and partial-legacy database scenarios, including repeat migration and preservation of legacy values without fabricating observation timestamps.
- The dedicated job retains direct Phase 18.5 and Phase 19.5/19.7 checks plus Phase 21.14, Phase 21.15 Node runtime verification, Phase 21.16 hash/documentation check, and Phase 21.17 migration regression. Phase 19.5/19.7 are also included in the broader Phase 19.12 cumulative gate in the baseline job; this cross-job repeat is retained to preserve the focused capacity-evidence job's independent coverage and diagnostics.

No regression file, package script, assertion, or cumulative gate was changed. Workflow change: remove only the redundant direct Phase 21.3 invocation. Commit: `ab371a510f52b5f8bf43dec57f4e3df21713cd75`. Source-level verification is complete; CI execution remains unverified until GitHub reports a run.


## Logistics CI overlap audit (2026-11-21)

Traced the Logistics workflow jobs against the actual cumulative scripts and package aliases:

- Baseline L11.1, L11.3, L11.4, L11.5, L11.6, and L11.7 each map to distinct regression files (contract, persistence, service, authorization, feasibility contract, feasibility service/evidence). The authenticated HTTP and timezone-aware UI checks are also separate targets. They are not executed by the L8-L21 cumulative gate and remain in baseline.
- Baseline L11.8 mapped to `phase0/logistics-scheduling-decision-regression.mjs`, which is already executed as the L11 layer by `phase0/logistics-l8-l21-cumulative-exit-gate.mjs` under the dedicated Logistics exit-certification job. Removed only the duplicate direct L11.8 invocation from baseline. Its package alias and its execution inside the cumulative gate remain intact.
- The Phase 13.10.15 gate is a separate Phase 13.10 logistics regression chain: it runs the Phase 13.10.7 gate (covering Phase 13.10.1-.6 plus Phase 12.2/.3) and Phase 13.10.9-.14 checks. It does not replace the standalone L11.1-.7 tests or the L8-L21 cumulative gate. Renamed the workflow step from the ambiguous `L1-L7` label to `Phase 13.10.15 cumulative Logistics regression gate`; no command changed.
- The L8-L21 gate executes each layer L8, L9, L8-L10, and L11-L21 once. The final-certification wrapper verifies required package aliases/artifacts and invokes that cumulative gate once; its required-source list is not a second execution of those regressions.
- `test:logistics-l18` is also run in the dedicated `logistics_l18` job and inside the L8-L21 cumulative gate. Retained both: the focused L18 job supplies isolated P2P-delivery diagnostics alongside its related assignment/queued-fulfillment checks, while the L8-L21 gate remains independently runnable as the full Logistics exit boundary.
- GAP-2 tests in baseline map to separate authorization, lifecycle, dispatch, read-scope, frontend, certification, route-scope, cross-feature, adversarial, and readiness regression files. The L18 job's GAP-2 assignment-authority check is a different file and remains in that focused job. No exact duplicate GAP-2 target was found across these workflow jobs.

Workflow commit: `d1d78b2b83179929f3a4638dc2afd4abd0e62609`. The only test invocation removed was baseline L11.8; all other test commands, package aliases, source files, and assertions remain unchanged. Source-level verification completed; CI remains unverified until an actual GitHub Actions run is reported.


### Logistics test-boundary distinction (additional source review)

Reviewed the Phase 13.10.12-.14 tests alongside GAP-2 assignment/dispatch/cross-feature tests to avoid confusing thematic overlap with duplicate coverage:

- Phase 13.10.12 is a provider-neutral courier assignment contract/projection (`persistence: none`, idempotent contract replay); GAP-2 assignment authority verifies the actual server-side `delivery_assignments` persistence, authorization, courier ownership, location scope, idempotency, and API boundary. These are complementary contract-versus-runtime checks.
- Phase 13.10.13 verifies the explicit non-build/no-route-authority boundary (no Logistics route source/persistence/migration); GAP-2.8 verifies the existing delivery assignment read projection and organization/location scoping. These are not the same route implementation.
- Phase 13.10.14 adversarially checks cross-feature contract consistency across order, fulfillment, shipment, proof/return, and courier projections; GAP-2.9 checks the actual transactional delivery-to-fulfillment-to-inventory consequence and payment/settlement separation, while GAP-2.10 checks runtime lifecycle/assignment idempotency and serialization. They cover different layers and must remain.

No additional Logistics test removal is justified by this semantic comparison.


## Workflow-wide direct invocation scan (2026-11-21)

After the Logistics cleanup, scanned every `run:` command in `.github/workflows/ci.yml`, resolving direct `npm run <script>` commands through the root `package.json` to their Node regression targets and including direct `node phase0/...` commands. Across the seven workflow job/trigger sections, the scan found no identical regression target invoked directly by more than one job. This scan intentionally covers direct workflow invocations only; nested cumulative-gate execution is audited separately above and retains documented independent certification overlaps (for example L18 and Phase 19.5/19.7). The scan does not claim that different test files have no semantic overlap.


## Baseline non-Logistics cumulative-gate and Payment coverage audit (2026-11-21)

Reviewed the remaining baseline workflow commands against the Phase 14, 15, 16, 19, and 20 gate implementations and the GAP-1 / PF-1 Payment regression files.

### Baseline direct invocation inventory

Resolved every baseline `run:` command through the root `package.json` and expanded chained Node commands. The baseline contains 157 resolved `phase0` Node regression targets and no exact duplicate target among its direct invocations. This includes the three targets chained under `test:service-catalog-frontend-sync`; they are separate regression files. The scan is exact-file based and does not imply that distinct files never inspect related source invariants.

### Country and platform gates

- Phase 14.13 directly executes Phase 14.0–14.12, including the currency/money regression. The removed standalone Phase 14.3 workflow step therefore remains covered by Phase 14.13. Phase 14.15 is a final artifact/engine snapshot check; it verifies files and Node engine metadata rather than rerunning the Phase 14 suite.
- Phase 15.21 invokes Phase 15.20 as its compatibility preflight. Phase 15.20 is a contract/matrix assertion gate, not a second workflow step or a separate set of child regression processes. Keep the Node 24 final gate as the independent runtime certification boundary.
- Phase 16.12 executes the 12 Phase 16 controls plus Golden Regression. Phase 16.13 reruns Phase 16.12 before checking Node >=24, and Phase 16.14 invokes Phase 16.13 as its final snapshot certification. The Phase 16.12 repetitions are intentional self-contained preflight; do not make the final gate rely on an earlier workflow step.
- Phase 19.12 cumulative executes Phase 19.2–19.12, Phase 18.12, Phase 16.12, SC-02, and Golden. Phase 20.12 executes Phase 20.1–20.11 and independently preflights Phase 19.12 full exit, Phase 18.12, Phase 16.12, and Golden. This means some prerequisite files (notably Phase 19.12 full exit, Phase 16.12, and Golden) are repeated across cumulative gates. Retain these repetitions: each exit gate must be independently runnable and preserve its own prerequisite validation. Phase 20.12 does not call the entire Phase 19.12 cumulative gate.

### Payment coverage

- GAP-1.19 production gate, Payment E2E, and adversarial certification files each run their own assertions; they do not spawn or invoke the earlier GAP-1 regression scripts.
- GAP-1.18AD checks that required prior provider-security/recovery/invariant package scripts and CI wiring exist; it does not re-execute those test files.
- PF-1J is a static authority/lineage/idempotency/tenant-isolation certification; PF-1K checks frontend order-sync/payment lifecycle ordering; PF-1 contract/integration/projection and PF-2 adversarial tests cover separate frontend boundaries. These files do not invoke one another as nested test runners.
- GAP-1.18I migration independence, GAP-1.23 notification identity/migration retry, and GAP-1.18Q/U idempotency checks remain separate runtime/migration invariants. No safe Payment test deletion or consolidation was established by this review.

Decision: no additional workflow or test-source change. Preserve the remaining baseline tests and the cumulative prerequisite repetitions described above. Existing workflow consolidation CI status remains unverified; this audit is source-level only.


## Platform and Payment source-to-test coverage audit (2026-11-21)

Scope: inspected the Phase 16.0–16.11 implementation modules, their individual regressions, the Phase 16.12 cumulative gate, Payment Core and frontend modules, selected GAP-1/PF-1 regressions, and the actual backend server composition. This is a source-level coverage audit; no runtime test or CI execution is claimed here.

### Platform coverage map

| Boundary | Implementation | Regression evidence | Classification |
|---|---|---|---|
| Capability contracts | `app/src/platform/capability-contract.js` | Phase 16.1 validates capability definitions, action resolution and invalid inputs | Implemented; contract-level tests |
| Canonical authority registry | `app/src/platform/authority-registry.js` | Phase 16.2 checks canonical authority mapping and capability resolution | Implemented; mapping tests, not domain execution tests |
| Adapter framework | `app/src/platform/adapter-framework.js` | Phase 16.3 covers registration, replacement, boundary resolution and forbidden persistence claims | Implemented; process-local registry/execution boundary |
| Integration contracts | `app/src/platform/integration-contract.js` | Phase 16.4 validates integration definition and rejects ownership/persistence claims | Implemented; contract tests |
| Capability discovery | `app/src/platform/capability-discovery.js` | Phase 16.5 validates metadata discovery and boundary behavior | Implemented; read-only discovery tests |
| Contract versioning | `app/src/platform/contract-versioning.js` | Phase 16.6 covers parsing/compatibility contract | Implemented; pure contract tests |
| Event/outbox composition | `app/src/platform/event-outbox-platform.js` | Phase 16.7 validates versioned envelopes, existing outbox delegation and supported event types | Implemented; injected enqueue and boundary tests |
| Integration gateway | `app/src/platform/integration-gateway.js` | Phase 16.8 tests tenant scope, unknown integration, undeclared action, mandatory/denied authorization and injected handler delegation | Implemented; gateway execution is tested with injected handler/authorization, not a live provider transport |
| Tenant/country/vertical composition | `app/src/platform/tenant-country-vertical.js` | Phase 16.9 tests active, candidate, regional-only and unknown country paths, duplicate/unknown verticals | Implemented; composition/fail-closed tests |
| AI capability boundary | `app/src/platform/ai-capability-boundary.js` | Phase 16.10 tests structured intent, read/mutation risk and no direct execution/persistence | Implemented; intent-boundary tests |
| Platform security | `app/src/platform/platform-security.js` | Phase 16.11 tests valid manager access, viewer denial, cross-organization denial, candidate/regional country denial, missing tenant context and forbidden authority fields | Implemented; delegates to existing authorization and composition authorities |

Phase 16.12 executes all twelve controls and Golden Regression. It also verifies the expected source artifacts and key authority boundaries. Several controls are contract/unit-level checks; the suite should not be interpreted as proof that every platform integration is deployed or connected to a live provider.

### Platform integration evidence still unverified

- The adapter framework explicitly uses a process-local metadata registry and dependency-injected executor. That is appropriate as a neutral framework boundary, but does not itself establish durable provider registration or production provider connectivity.
- The Phase 16.8 regression proves authorized delegation to an injected capability handler. Inspection of `backend/server.js` did not find a call to `executeIntegrationGatewayRequest` or an import of the generic Platform integration gateway. Therefore a production HTTP route using this generic gateway is not evidenced by this inspection. This is an integration/deployment question, not proof that the generic contract is defective.
- Phase 16.7 deliberately delegates to the existing client outbox and backend sync consumer. Its regression tests the envelope and injected enqueue behavior; it does not establish that every domain event is accepted by the backend consumer. The backend consumer remains explicitly limited to its supported event types.
- No new gateway route, provider registry, persistence store, or event infrastructure is recommended until a concrete integration use case and owning API boundary are selected.

### Payment coverage map

| Boundary | Implementation | Regression evidence | Classification |
|---|---|---|---|
| Canonical financial lifecycle | `backend/lib/payments/payment-core.js` | GAP-1.18AA/AB/AC and related GAP-1 tests exercise recovery, authorization, evidence trust, tenant-bound decisions, transaction and retention invariants | Implemented; substantial unit/runtime coverage |
| Durable persistence and financial commit | `backend/lib/store-sqlite.js` | GAP-1.18AC and GAP-1.23 SQLite regressions exercise deletion protection, evidence identity and migration retry scenarios | Implemented; targeted real-SQLite coverage |
| Provider notification identity | Payment Core plus provider-notification authority and SQLite store | GAP-1 provider notification and GAP-1.23 identity regressions cover authentication context, identity conflict and stopping before confirmation/finalization | Implemented; targeted runtime coverage |
| Frontend API client | `app/src/payments/client.js` and `contract.js` | PF-1 integration tests exercise request paths, auth/idempotency contracts and response normalization | Implemented; client contract/runtime tests |
| Frontend projection/state | `app/src/payments/projection.js` and `state.js` | PF-1K and projection/stale-state tests check canonical refresh ordering and unavailable/stale status handling | Implemented; mixed static and runtime coverage |
| Checkout evidence UX boundary | `app/src/orders/payment-proof.js` and order queue | Checkout clarity and PF-1 tests verify evidence is not treated as verification or financial confirmation | Implemented; targeted source and client tests |
| End-to-end HTTP/SQLite recovery | `backend/server.js`, Payment Core, SQLite store and frontend client | PF-1L starts the actual backend in a child process, uses temporary SQLite and a local test provider server, and exercises lost-response replay, retry, tenant rejection and crash/restart boundaries | Implemented; strong integration regression with a simulated provider, not a live third-party provider |
| Production readiness declaration | GAP-1.18AD and GAP-1.19 tests | 1.18AD checks script/CI wiring and selected source invariants; 1.19 exercises blocked readiness and fixture-based E2E/adversarial paths | Partial evidence; not proof of a live production provider |

### Payment limitations to preserve in status reporting

- PF-1L is meaningful end-to-end evidence, but its provider is a local test server. It does not certify external provider credentials, production network behavior, provider webhook configuration, or live settlement operations.
- GAP-1.18AD is a wiring/source readiness regression, not an independent production certification. GAP-1.19 explicitly verifies a blocked result when provider configuration, adapter certification or live external capability evidence is missing.
- The targeted checkout clarity and stale-state regressions are primarily source assertions. They do not, by themselves, prove all payment screens through rendered browser interaction/accessibility workflows. Do not infer the absence of all browser coverage elsewhere in the repository from these two tests.
- Frontend payment state remains an in-memory projection; the canonical financial record remains in backend Payment Core/SQLite. No second frontend ledger was found in the inspected modules.

### Audit conclusion and next priority

- Platform: implemented at contract/composition level with focused security and injected-execution tests; production deployment/use of the generic integration gateway is unverified.
- Payment: canonical backend authority, frontend client/projection, and robust local HTTP/SQLite recovery coverage exist; live external provider certification remains a separate unresolved operational requirement.
- No duplicate Platform or Payment authority was identified in the inspected implementation modules. No code, test assertion, package script or workflow change is justified by this audit.
- Next useful audit: trace each concrete Payment provider adapter from registration through configuration/authentication, outbound request, callback ingress, evidence verification and canonical financial commit. Mark each stage as simulated, configured, exercised against sandbox, or proven in production. Do not label the provider layer production-ready without that evidence.


## Payment provider adapter production-readiness trace (2026-11-21)

Follow-up inspection traced `backend/lib/payments/provider-registry.js`, `provider-adapters.js`, `provider-adapter-config.js`, `provider-probe-transport.js`, `provider-verification-parsers.js`, provider adapter regressions, and the provider notification HTTP route in `backend/server.js`.

### What exists

- Provider IDs are registered for manual/cash, Telebirr, CBE, M-Pesa and Bank of Abyssinia. The external providers start as explicitly unconfigured registry entries; `backend/server.js` replaces them with the generic adapters from `PROVIDER_ADAPTERS`.
- External adapter configuration reads process environment variables for a base URL and API key. The config projection returns only base URL and a boolean `hasCredential`, not the credential value.
- Telebirr, CBE, M-Pesa and BOA adapters currently share a temporary Bearer-token header convention. The transport is provider-neutral, uses `fetch`, has a timeout and bounded retries for selected HTTP/network failures.
- Generic `verify` and `getStatus` methods exist, but require caller-supplied path/method context. The adapter's declared capabilities currently advertise `getMetadata` and `probeCapability`; `authenticateNotification` is explicitly false, and `verify`/`getStatus` are not declared as executable capabilities.
- Provider-specific verification parsers exist for the four named providers. Adapter regression coverage exercises configuration, probe behavior, bearer header placement and generic transport behavior.

### Confirmed production gaps

1. **Inbound notification authentication is not implemented for these four adapters.** Each adapter's `authenticateNotification` throws `PAYMENT_NOTIFICATION_AUTH_NOT_CONFIGURED` (HTTP 501). The actual route `POST /integrations/payments/:providerId/notifications` checks the capability first and returns `PAYMENT_NOTIFICATION_NOT_CONFIGURED` (HTTP 503) before reading/processing the notification. Consequently these four adapters cannot currently complete provider webhook/callback ingestion through this route.
2. **Provider auth is a temporary shared Bearer convention, not verified provider-specific auth.** No provider-specific OAuth/HMAC/signature/certificate implementation is present in the inspected adapters. The source comment explicitly labels the convention temporary.
3. **No initiation, refund or reconciliation transport is implemented in these four generic adapters.** The registry exposes those operations as part of the normalized provider interface, but the generic adapters do not implement them; unsupported-operation wrappers therefore remain in effect.
4. **Verification/status endpoints are not provider-complete by configuration alone.** Their paths and methods are supplied through operation context, rather than a provider-specific endpoint contract. A base URL and API key alone do not establish a working verification/status integration.
5. **Current tests are synthetic/local.** Adapter and transport tests use injected `fetch` functions and example URLs; they prove mechanics, not successful sandbox or production communication with Telebirr, CBE, M-Pesa or BOA.

### Status decision

- Payment Core and canonical persistence remain the financial authority; no second authority is needed.
- Provider adapter framework/configuration/transport/parser foundations: **implemented**.
- External verification/status adapter execution: **partial and not provider-certified**.
- Inbound notifications for the four generic adapters: **missing / explicitly disabled**.
- Initiation, refund and reconciliation for the four generic adapters: **missing / unsupported**.
- Sandbox or production evidence for any named provider: **not established by repository tests**.

Do not claim the four external providers are production-integrated based on registry presence, environment configuration shape, generic HTTP transport or local tests. The next implementation decision should select one provider and obtain its official API/authentication specification, sandbox credentials and callback requirements. Only then should the existing adapter be completed provider-specifically, with tests for outbound verification/status and authenticated inbound notification, while leaving Payment Core and canonical financial commit unchanged. No provider adapter or new credential authority should be invented in advance.
