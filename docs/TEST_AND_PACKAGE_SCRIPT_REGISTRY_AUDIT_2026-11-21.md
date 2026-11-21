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

## Recommended next action

Perform a consumer/reference audit of the 11 duplicate groups, then make a small alias cleanup batch only for names proven unused. Separately map every package script to its target file and classify each target as focused regression, cumulative gate, diagnostic, operational command, or obsolete/unreferenced. Do not delete tests or weaken CI as part of this naming cleanup.
