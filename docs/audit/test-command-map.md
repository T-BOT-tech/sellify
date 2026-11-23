# Test command and CI map

Baseline `e216db18ade2a5ffa66aff9dc3096e207251a918`; root package blob `f7041ced712b6e70d0cc00d0e3f3da1d80c6c0aa`.

## Root npm script inventory

- **482** root scripts; **476** names match test/regression/check/verification/certification/gate/baseline naming.
- Command targets: **475** direct Node scripts, **2** shell scripts, **5** nested-package commands.
- **11** exact duplicate-command groups involve **46** script names.
- **171** distinct root scripts are directly referenced by the 11 workflow files; **311** are not reachable from those direct CI references. That is not proof of obsolescence: local workflows, docs, nested scripts, manual certification and external consumers may still rely on them.
- All direct Node/shell targets and nested script references resolve in the current tree; no CI script reference is missing.
- The proposed `test`, `test:integration`, `test:security`, `test:e2e`, and `test:release` commands are **not present** in `package.json`.

## Duplicate execution identities

The 11 duplicate groups are retained in the JSON. The largest alias families are Logistics L11 (9 names), L20 (10 names), and L21 (11 names), each mapping to one physical regression file. The other duplicate groups include Marketplace, Procurement RFQ/comparison, GAP-2 lifecycle, Phase 16.13.13/16.13.17, and the `dev` alias. These names do not represent independent test programs. Do not delete or rename aliases until all references and phase acceptance semantics are reconciled.

## CI workflow/job map

| Workflow | Jobs | Purpose |
|---|---|---|
| `ci.yml` | `baseline`, `phase13_10_24`, `logistics_l18`, `logistics_exit_certification`, `phase21_capacity_evidence` | Main cross-domain, security, HTTP, browser, Logistics and capacity regression surface |
| `release-certification.yml` | `release-certification` | Node 24 runtime gate, P1-22–P1-25 cumulative checks and release evidence |
| `logistics-runtime-certification.yml` | `logistics-certification` | Logistics master exit and L8–L21/provider stack certification |
| `perplexity-audit.yml` | `inventory-regression` | Route and SQLite static inventory regressions; uploads generated artifacts |
| `security.yml` | `source-hygiene` | Tracked-secret and runtime database/backup rejection; it is not the full authorization regression suite |
| `deployment-certification.yml` | `deployment-smoke` | Manually dispatched public deployment health/runtime smoke |
| Supplier Network focused workflows | Activation authorization, capacity evidence, discovery HTTP, performance visibility, trust visibility | Narrow path-filtered regressions; not all are part of the main push workflow |

The JSON records every extracted `npm run` and direct `node phase0` reference by workflow, job, step, line and command. The main CI `baseline` job carries most Payment, Inventory, IAM, Tenant Isolation, Customer, Offline Outbox, B2B, Telegram, browser-module and service regressions. The `phase13_10_24` job includes workspace/browser and service booking coverage. Logistics L18 and exit certification are separate jobs. Supplier Network focused workflows use branch/path triggers; their existence does not mean every such test runs on every main push.

## Security, integration, E2E and release mapping

Suite tags in the JSON are keyword-based candidates and overlap. The main workflow includes direct security evidence such as tenant isolation, location scope, IAM/contextual-role, API-boundary, inventory sync authorization, Payment security, Logistics authorization and adversarial delivery checks. The separate `security.yml` job only enforces source hygiene; do not mistake it for the full security test suite. The route audit found no focused HTTP authorization regression for the Payment routing-policy GET/POST endpoints or POST /sync: existing Payment security coverage exercises PaymentCore, while the routing bootstrap regression calls store functions directly. Add route-level assertions for denied roles, allowed roles, tenant/location scope and mutation side effects.

Integration coverage includes HTTP/API, SQLite persistence, migrations, event/outbox/replay, Inventory/Procurement bridges, Payment lifecycle, Supplier Network visibility, and cross-pack contracts. E2E candidates include browser/UI, storefront, checkout, Telegram and first-merchant journeys. Release certification is distinct: the release workflow enforces Node major >=24 and `node:sqlite`, then runs P1-22 through P1-25 and `phase0:release-check`. The main CI Node 24 matrix and release workflow passing do not replace a deployment smoke run.

## Source-hash dependencies

There are **189** `.sha256` files in the repository. A verified sample includes at least **11** manifests pinning root `package.json` and at least **2** pinning `.github/workflows/ci.yml`; `PHASE21.18-SOURCE-HASHES.sha256` pins both. Historical Phase 13/15/FUX and later Phase 22 manifests coexist. The Phase 22 handoffs explicitly acknowledge historical Phase 21 package-hash drift after later script additions; historical hashes must not be rewritten to make the current tree appear to match an old snapshot.

Therefore, do **not** edit `package.json` or `ci.yml` merely to add convenience aliases before reconciling the active/current manifests and the historical snapshots. The five wrapper commands can be proposed as additive aliases, but the manifest/hash impact must be approved and validated separately. Do not delete historical scripts.

## Proposed non-destructive wrappers (not implemented)

- `test`: fast local contract and focused regression set.
- `test:integration`: API/HTTP, SQLite, migrations, events, outbox/replay and cross-domain integration.
- `test:security`: authorization, tenant/organization/location/resource scope, privilege escalation, sensitive actions and adversarial regressions.
- `test:e2e`: browser/UI, Telegram/storefront, checkout and critical buyer/seller journeys.
- `test:release`: existing Node 24 runtime gate, cumulative P1 release checks, hash/snapshot verification and release evidence.

Keep every existing script unchanged. Each wrapper should call canonical existing commands exactly once, avoid duplicate aliases, and preserve separate release/security jobs. No package or CI file was changed in this audit.

## Current-main CI evidence

At `e216db18ade2a5ffa66aff9dc3096e207251a918`, GitHub reports successful completion for Sellify CI, Sellify Release Certification, Logistics Runtime Certification, Perplexity audit inventory, and Repository Security Checks. The check runs include `baseline (24)`, `phase13_10_24 (24)`, `phase21_capacity_evidence`, `logistics_l18 (24)`, `logistics_exit_certification`, and source hygiene. This is commit-specific CI evidence, not a claim that every root script was executed.
