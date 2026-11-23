# Test command map

- Source commit: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Sources: `package.json`, `.github/workflows/*.yml`
- Package scripts: **482**
- `test:`-prefixed scripts: **345**
- Direct workflow invocations: **203** (173 `npm run` and 30 direct Node files)
- Source hash/source manifest files: **185**

## Current script interface

- There is no generic `npm run test` command and no `test:integration`, `test:security`, `test:e2e`, or `test:release` wrapper.
- 345 scripts use the `test:` prefix, but many additional historical phase/GAP/FUX/TG names are test commands too.
- Preserve historical script names; wrappers should be additive and should deduplicate exact command targets.

## Exact duplicate command aliases

| Exact command | Script aliases |
|---|---|
| `npm --prefix backend run dev` | `dev`, `dev:backend` |
| `node phase0/phase11.4-marketplace-integrity-regression.mjs` | `phase11.4:marketplace-test`, `test:phase13.10.24-marketplace-fulfillment` |
| `node phase0/phase17.3-rfq-response-regression.mjs` | `phase17.3:procurement-rfq-test`, `phase17.3:rfq-response-test` |
| `node phase0/phase17.3-rfq-contract-regression.mjs` | `phase17.3:procurement-rfq-contract-test`, `phase17.3:rfq-contract-test` |
| `node phase0/phase17.4-comparison-regression.mjs` | `phase17.4:procurement-comparison-test`, `phase17.4:comparison-test` |
| `node phase0/phase17.4-comparison-contract-regression.mjs` | `phase17.4:procurement-comparison-contract-test`, `phase17.4:comparison-contract-test` |
| `node phase0/gap-2-delivery-assignment-lifecycle-regression.mjs` | `test:gap-2-delivery-lifecycle`, `test:gap-2-delivery-exception` |
| `node phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs` | `test:phase16.13.13`, `test:phase16.13.17` |
| `node phase0/logistics-scheduling-decision-regression.mjs` | `test:logistics-l11.8`, `test:logistics-l11.8-l11.9`, `test:logistics-l11.10`, `test:logistics-l11.11`, `test:logistics-l11.12`, `test:logistics-l11.13`, `test:logistics-l11.14`, `test:logistics-l11.15`, `test:logistics-l11.16` |
| `node phase0/logistics-network-corridor-intelligence-regression.mjs` | `test:logistics-l20.1`, `test:logistics-l20.2`, `test:logistics-l20.3`, `test:logistics-l20.4`, `test:logistics-l20.5`, `test:logistics-l20.6`, `test:logistics-l20.7`, `test:logistics-l20.8`, `test:logistics-l20.9`, `test:logistics-l20.10` |
| `node phase0/logistics-external-network-expansion-regression.mjs` | `test:logistics-l21.1`, `test:logistics-l21.2`, `test:logistics-l21.3`, `test:logistics-l21.4`, `test:logistics-l21.5`, `test:logistics-l21.6`, `test:logistics-l21.7`, `test:logistics-l21.8`, `test:logistics-l21.9`, `test:logistics-l21.10`, `test:logistics-l21.11` |

Ten duplicate groups are test aliases; one is the `dev`/`dev:backend` alias. Several large alias groups (Logistics L11, L20, L21) run the same underlying regression file under multiple historical phase names. These aliases are not independent test suites.

## CI and workflow mapping

| Workflow | Job | npm scripts | Direct Node files |
|---|---|---|---|
| `.github/workflows/ci.yml` | push | — | — |
| `.github/workflows/ci.yml` | pull_request | — | — |
| `.github/workflows/ci.yml` | logistics_l18 | `test:logistics-service-delivery-model`, `test:fulfillment-queued-target-reconciliation`, `test:logistics-l18` | `phase0/gap-2-delivery-assignment-authority-regression.mjs` |
| `.github/workflows/ci.yml` | logistics_exit_certification | `test:phase13.10.15`, `test:logistics-l8-l21-certification` | `phase0/logistics-master-specification-exit-audit.mjs` |
| `.github/workflows/ci.yml` | phase13_10_24 | `test:phase13.10.24-workspace-projection`, `test:phase13.10.24-workspace-browser`, `test:phase13.10.24-marketplace-boundary`, `test:service-catalog-http`, `test:service-booking-operator-workspace`, `test:service-window-assessment`, `test:sc-03.4-resource-commitment-migration`, `test:sc-03.5-service-provider-queue`, `test:service-bookings-appointments-navigation`, `test:sc-03.5-buyer-appointments`, `test:sc-03.5-appointments-browser`, `test:sc-03.5-appointments-http` | `phase0/phase13.11.22-current-verification-gate.mjs`, `phase0/phase13.11.20-current-documentation-integrity-regression.mjs`, `phase0/phase13.11.21-current-snapshot-exit-regression.mjs`, `phase0/service-booking-operator-browser-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | `test:outbox-tenant-scope`, `test:order-sync-idempotency`, `phase11.3:invoice-test`, `test:phase13.12.6`, `phase13.8.6:restaurant-order-payment-test`, `test:service-catalog-contract`, `test:service-booking-contract`, `test:service-booking-persistence`, `test:service-resource-migration-compatibility`, `test:service-booking-scheduling-boundary`, `test:service-resource-foundation`, `test:service-resource-persistence`, `test:service-provider-resource-scope`, `test:first-merchant-to-first-checkout`, `test:first-experience-tenant-isolation-http`, `test:marketplace-order-payment-bootstrap`, `test:service-catalog-frontend-sync`, `test:first-experience-ecosystem-discovery`, `test:first-experience-returning-merchant`, `test:first-experience-onboarding-browser`, `test:first-experience-home-readiness`, `test:first-experience-workspace-activation`, `test:p1-13`, `test:p1-14`, `test:country-pack-onboarding`, `test:offline-outbox-recovery-journal`, `test:outbox-localstorage-fallback-race`, `test:offline-outbox-browser-runtime`, `gap-1.18:provider-verification-migration-test`, `test:backup-collision`, `test:backup-restore`, `test:payment-lineage-append-only`, `gap-1.18:decision-idempotency-test`, `gap-1.18:financial-transition-idempotency-test`, `test:browser-module-serving`, `test:browser-module-serving-http`, `test:browser-module-serving-production-http`, `test:browser-module-serving-browser`, `test:j5-canonical-low-stock-journey`, `phase0:test`, `phase11.4:marketplace-test`, `test:phase17.10`, `test:checkout-payment-state-clarity`, `test:fux-31`, `test:fux-31-accessibility`, `fux26:storefront-contract-test`, `test:first-product-empty-state`, `test:fux-42`, `test:fux-44`, `test:fux-46`, `test:fux-47`, `test:fux-48`, `test:fux-49`, `test:fux-50`, `test:inventory-movement-replay-runtime`, `test:inventory-sync-event-authorization-http`, `test:inventory-movement-batch-runtime`, `test:inventory-movement-batch-http`, `test:fux-51`, `test:restaurant-recipe-persistence`, `test:fux-52`, `test:fux-53`, `test:fux-54`, `test:gap-5-iam`, `test:fux-55`, `tg1:telegram-storefront-test`, `tg4:telegram-buyer-test`, `tg5:telegram-buyer-test`, `tg6:telegram-checkout-test`, `tg7:telegram-buyer-orders-test`, `tg8:telegram-fulfillment-test`, `tg10:telegram-security-test`, `test:fux-56`, `test:fux-57`, `test:sc-03.5-location-timezone`, `test:sc-03.5-location-aware-availability-timezone`, `gap-1.10:payment-concurrency-test`, `gap-1.11:payment-status-test`, `gap-1.12:payment-reconciliation-test`, `gap-1.13:payment-lifecycle-test`, `gap-1.14:payment-refund-test`, `gap-1.15:payment-settlement-test`, `gap-1.16:payment-routing-test`, `gap-1.17:payment-operations-test`, `test:gap-1.23-migration-retry`, `gap-1.23:provider-notification-identity-test`, `gap-1:provider-notification-core-test`, `gap-1.18:payment-provider-capability-test`, `gap-1.18:payment-provider-evidence-test`, `gap-1.18:payment-provider-probe-test`, `gap-1.18:payment-provider-config-test`, `gap-1.18:payment-provider-transport-test`, `gap-1.18:payment-provider-adapters-test`, `gap-1.18:payment-evidence-authority-test`, `gap-1.18:capability-certification-test`, `gap-1.18:provider-verification-result-test`, `gap-1.18:provider-local-parsers-test`, `gap-1.18:provider-verification-lifecycle-test`, `gap-1.18:provider-error-taxonomy-test`, `gap-1.18:provider-batch-verification-test`, `gap-1.18:provider-verification-persistence-test`, `gap-1.18:verification-decision-binding-test`, `gap-1.18:verification-freshness-test`, `gap-1.18:payment-financial-invariant-binding-test`, `gap-1.18:provider-transaction-uniqueness-test`, `gap-1.18:verification-provenance-test`, `gap-1.18:audit-lineage-test`, `gap-1.18:payment-failure-recovery-test`, `gap-1.18:payment-security-boundary-test`, `gap-1.18:payment-invariant-certification-test`, `gap-1.18:payment-production-readiness-test`, `gap-1.19:payment-production-certification-test`, `gap-1.19:payment-e2e-certification-test`, `gap-1.19:payment-adversarial-certification-test`, `test:pf-1-payment-frontend-contract`, `test:pf-1-payment-frontend-integration`, `test:pf-1-payment-frontend-projection`, `test:pf-2-payment-frontend-adversarial`, `test:payment-ui-stale-state`, `test:pf-1-payment-frontend-http-sqlite-e2e`, `test:logistics-l11.1`, `test:logistics-l11.3`, `test:logistics-l11.4`, `test:logistics-l11.5`, `test:logistics-l11.6`, `test:logistics-l11.7`, `test:logistics-scheduling-http`, `test:logistics-scheduling-ui`, `test:gap-2-logistics-authz`, `test:gap-2-courier-multi-location`, `test:gap-2-delivery-lifecycle`, `test:gap-2-dispatch-workload`, `test:gap-2-delivery-read-scope`, `test:gap-2-delivery-frontend`, `test:gap-2-delivery-certification`, `test:gap-2-route-dispatch-scope`, `test:gap-2-cross-feature-consistency`, `test:gap-2-adversarial-delivery`, `test:gap-2-production-readiness`, `test:country-evidence-source-registry`, `test:phase14.13`, `test:phase14.15`, `test:phase15.21`, `test:phase16.14`, `test:phase19.12-cumulative`, `test:phase20.12` | `phase0/ecosystem-add-menu-regression.mjs`, `phase0/inventory-refresh-lifecycle-regression.mjs`, `phase0/inventory-refresh-behavior-regression.mjs`, `phase0/p1-05-scope-context-regression.mjs`, `phase0/customer-http-audit-provenance-regression.mjs`, `phase0/order-queue-order-value-label-regression.mjs`, `phase0/take-order-sticky-cart-accessibility-regression.mjs`, `phase0/home-command-center-attention-regression.mjs`, `phase0/phase10.5-inventory-ledger-regression.mjs`, `phase0/gap-1.19-payment-production-certification-http-regression.mjs`, `phase0/http-response-contract-regression.mjs`, `phase0/gap-1-provider-confirmation-finalization-regression.mjs` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | `test:phase19.7`, `test:phase21.14` | `phase0/phase18.5-supplier-network-capacity-regression.mjs`, `phase0/phase19.5-supplier-network-federation-regression.mjs` |
| `.github/workflows/supplier-network-activation-authorization.yml` | push | — | — |
| `.github/workflows/supplier-network-activation-authorization.yml` | pull_request | — | — |
| `.github/workflows/supplier-network-activation-authorization.yml` | supplier_network_activation_authorization | — | `phase0/supplier-network-activation-http-authorization-regression.mjs` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | push | — | — |
| `.github/workflows/supplier-network-capacity-evidence.yml` | pull_request | — | — |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | — | `phase0/phase21.17-capacity-evidence-migration-regression.mjs`, `phase0/phase21.18-current-verification-regression.mjs`, `phase0/phase21.20-procurement-rfq-capacity-evidence-snapshot-regression.mjs` |
| `.github/workflows/supplier-network-discovery-http.yml` | push | — | — |
| `.github/workflows/supplier-network-discovery-http.yml` | pull_request | — | — |
| `.github/workflows/supplier-network-discovery-http.yml` | supplier_network_discovery_http | — | `phase0/supplier-network-discovery-http-authorization-regression.mjs` |
| `.github/workflows/supplier-network-performance-visibility.yml` | push | — | — |
| `.github/workflows/supplier-network-performance-visibility.yml` | pull_request | — | — |
| `.github/workflows/supplier-network-performance-visibility.yml` | supplier_network_performance_visibility | — | `phase0/supplier-network-performance-visibility-regression.mjs` |
| `.github/workflows/supplier-network-trust-visibility.yml` | push | — | — |
| `.github/workflows/supplier-network-trust-visibility.yml` | pull_request | — | — |
| `.github/workflows/supplier-network-trust-visibility.yml` | supplier_network_trust_visibility | — | `phase0/supplier-network-trust-qualification-visibility-regression.mjs` |
| `.github/workflows/deployment-certification.yml` | deployment-smoke | — | `phase0/deployment-certification.mjs` |
| `.github/workflows/logistics-runtime-certification.yml` | logistics-certification | `test:logistics-master-exit`, `test:logistics-l8-l21-certification`, `test:phase16.13-logistics-provider` | — |
| `.github/workflows/perplexity-audit.yml` | inventory-regression | — | `phase0/perplexity-route-inventory-regression.mjs`, `phase0/perplexity-store-inventory-regression.mjs` |
| `.github/workflows/release-certification.yml` | release-certification | `test:p1-22`, `test:p1-23`, `test:p1-24`, `test:p1-25`, `phase0:release-check` | — |
| `.github/workflows/security.yml` | source-hygiene | — | — |

### Workflow interpretation

- `ci.yml` has five jobs: Logistics L18, Logistics exit certification, Phase 13.10.24, baseline, and Phase 21 capacity evidence. The baseline job is the broadest suite.
- `logistics-runtime-certification.yml` runs the master Logistics exit, L8–L21 final certification, and Phase 16.13 provider stack.
- `release-certification.yml` runs P1-22 through P1-25 and `phase0:release-check`; it also enforces Node 24 and `node:sqlite` availability.
- `perplexity-audit.yml` runs the route and SQLite inventory regressions directly and uploads generated inventory artifacts.
- `deployment-certification.yml` is a separate deployed-runtime smoke gate.
- The five Supplier Network workflows are targeted regression gates for activation authorization, capacity evidence, discovery HTTP authorization, performance visibility, and trust qualification visibility.
- `security.yml` currently runs source-hygiene checks for committed secrets and runtime DB/backup files; it does not itself run the authorization/security regression suite.

## Security, integration, end-to-end and release classification

Counts below are overlapping name-based discovery tags, not exclusive categories:

- Security/auth/tenant/adversarial name matches: 14
- Integration/API/HTTP/persistence/bridge name matches: 47
- Browser/E2E/journey/UI name matches: 14
- Release/certification/gate/baseline name matches: 17

Security tests are spread across the baseline and domain suites. Examples include IAM, tenant isolation, Payment security boundaries, Inventory HTTP authorization, Logistics authorization, Telegram security, and adversarial delivery. Do not equate the `security.yml` source-hygiene workflow with complete security test coverage.

## Source-hash and certification dependencies

There are **185** source-hash/source-manifest files in the current tree. Historical manifests must remain intact; they are not candidates for bulk regeneration.

| Test / gate | Trigger | Purpose |
|---|---|---|
| `phase0/phase13.11.20-documentation-hash-regression.mjs` | `test:phase13.11.20` | documentation/source hash regression |
| `phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs` | `test:phase13.12.17` | hash/documentation source snapshot |
| `phase0/phase21.16-hashes-documentation-regression.mjs` | `test:phase21.16` | Phase 21 source hash documentation regression |
| `phase0/phase22.12-hashes-documentation-regression.mjs` | `test:phase22.12` | Phase 22 source hash documentation regression |
| `phase0/phase21.18-current-verification-regression.mjs` | direct workflow command | validates 11-entry PHASE21.18-SOURCE-HASHES.sha256 manifest and pinned script metadata |
| `phase0/phase13.11.22-current-verification-gate.mjs` | direct workflow command | current cross-pack verification gate; pinned by PHASE13.11.22 source hash manifest |
| `phase0/phase13.11.20-current-documentation-integrity-regression.mjs` | direct workflow command | current historical documentation continuity |
| `phase0/phase13.11.21-current-snapshot-exit-regression.mjs` | direct workflow command | current snapshot/exit continuity |

- The Phase 21.18 current-verification regression validates the 11-entry `PHASE21.18-SOURCE-HASHES.sha256` manifest, including the CI workflow hash and pinned metadata. Changes to `ci.yml` therefore require deliberate manifest reconciliation and the associated verification tests.
- The Phase 13.11.22 source-hash manifest pins the current verification gate and its documentation/snapshot checks. Preserve this chain when refreshing current-state documentation.
- Source-hash certification is distinct from runtime tests: a hash pass proves pinned file bytes match the manifest, not that a behavior or architecture boundary is correct.

## Wrapper recommendations (proposal only; package unchanged)

| Proposed command | Intended scope | Composition rule |
|---|---|---|
| `npm run test` | Fast default validation | Small smoke/contract set, not all 345 `test:` scripts; must be deterministic and safe on developer machines. |
| `npm run test:integration` | API, SQLite, adapter and cross-domain integration | Run each underlying target once; do not invoke duplicate aliases. |
| `npm run test:security` | Authentication, authorization, tenant/location isolation, adversarial and secret hygiene | Include route-level authorization regressions; add payment routing policy HTTP regression before considering this group complete. |
| `npm run test:e2e` | Browser and user-journey suites | Separate browser prerequisites and slower runtime from fast tests. |
| `npm run test:release` | Node 24, release evidence, source-hash and Logistics exit certification | Preserve required order and run on Node >=24; never substitute this for ordinary local tests. |

Do not add these wrappers until the exact underlying targets and CI overlap have been reviewed. Do not delete or rename historical scripts.

Machine-readable registry: `test-command-map.json`.