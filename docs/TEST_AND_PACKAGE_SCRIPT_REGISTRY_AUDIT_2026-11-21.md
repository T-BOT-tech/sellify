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
| Direct Node file commands | 473 | Targets resolve to tracked files in the current tree |
| Direct shell file commands | 2 | Targets resolve to tracked shell files |
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
