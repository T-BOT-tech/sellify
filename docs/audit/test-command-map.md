# Test command map

- Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- `package.json` scripts: **482**
- Test/regression/certification/gate-named scripts: **475**
- `phase0/` JS/MJS test files: **574**
- GitHub Actions workflows: **11**; jobs: **15**
- Explicit workflow `run:` commands: **223**
- Distinct package scripts called directly by CI: **171**
- Direct `node phase0/*.mjs` test files called by CI: **30**
- Test-like package scripts mapped to a CI command or direct Node step: **176**
- Test-like scripts not directly mapped to a CI command: **299**
- Duplicate test alias groups: **10**

> Test-like classification is name-based and deliberately overlapping. This map is command wiring evidence, not a claim that every test has run successfully on every branch.

## Suite families

| Family | Test-like script count |
|---|---:|
| contract/unit | 291 |
| release | 14 |
| integration | 153 |
| security | 16 |
| e2e | 23 |

## Duplicate aliases (same command, not separate test coverage)

- `phase11.4:marketplace-test`, `test:phase13.10.24-marketplace-fulfillment` → `node phase0/phase11.4-marketplace-integrity-regression.mjs`
- `phase17.3:procurement-rfq-test`, `phase17.3:rfq-response-test` → `node phase0/phase17.3-rfq-response-regression.mjs`
- `phase17.3:procurement-rfq-contract-test`, `phase17.3:rfq-contract-test` → `node phase0/phase17.3-rfq-contract-regression.mjs`
- `phase17.4:procurement-comparison-test`, `phase17.4:comparison-test` → `node phase0/phase17.4-comparison-regression.mjs`
- `phase17.4:procurement-comparison-contract-test`, `phase17.4:comparison-contract-test` → `node phase0/phase17.4-comparison-contract-regression.mjs`
- `test:gap-2-delivery-lifecycle`, `test:gap-2-delivery-exception` → `node phase0/gap-2-delivery-assignment-lifecycle-regression.mjs`
- `test:phase16.13.13`, `test:phase16.13.17` → `node phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs`
- `test:logistics-l11.8`, `test:logistics-l11.8-l11.9`, `test:logistics-l11.10`, `test:logistics-l11.11`, `test:logistics-l11.12`, `test:logistics-l11.13`, `test:logistics-l11.14`, `test:logistics-l11.15`, `test:logistics-l11.16` → `node phase0/logistics-scheduling-decision-regression.mjs`
- `test:logistics-l20.1`, `test:logistics-l20.2`, `test:logistics-l20.3`, `test:logistics-l20.4`, `test:logistics-l20.5`, `test:logistics-l20.6`, `test:logistics-l20.7`, `test:logistics-l20.8`, `test:logistics-l20.9`, `test:logistics-l20.10` → `node phase0/logistics-network-corridor-intelligence-regression.mjs`
- `test:logistics-l21.1`, `test:logistics-l21.2`, `test:logistics-l21.3`, `test:logistics-l21.4`, `test:logistics-l21.5`, `test:logistics-l21.6`, `test:logistics-l21.7`, `test:logistics-l21.8`, `test:logistics-l21.9`, `test:logistics-l21.10`, `test:logistics-l21.11` → `node phase0/logistics-external-network-expansion-regression.mjs`

## CI workflow/job command map

| Workflow | Job | Step | Command |
|---|---|---|---|
| `.github/workflows/ci.yml` | logistics_l18 | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/ci.yml` | logistics_l18 | GAP-2 canonical delivery assignment authority regression | `node phase0/gap-2-delivery-assignment-authority-regression.mjs` |
| `.github/workflows/ci.yml` | logistics_l18 | Logistics service delivery-model contract regression | `npm run test:logistics-service-delivery-model` |
| `.github/workflows/ci.yml` | logistics_l18 | Queued fulfillment target reconciliation regression | `npm run test:fulfillment-queued-target-reconciliation` |
| `.github/workflows/ci.yml` | logistics_l18 | Run L18 P2P Delivery product boundary regression | `npm run test:logistics-l18` |
| `.github/workflows/ci.yml` | logistics_exit_certification | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/ci.yml` | logistics_exit_certification | Audit Logistics master specification and authority boundaries | `node phase0/logistics-master-specification-exit-audit.mjs` |
| `.github/workflows/ci.yml` | logistics_exit_certification | Execute Phase 13.10.15 cumulative Logistics regression gate | `npm run test:phase13.10.15` |
| `.github/workflows/ci.yml` | logistics_exit_certification | Execute L8-L21 cumulative exit certification | `npm run test:logistics-l8-l21-certification` |
| `.github/workflows/ci.yml` | phase13_10_24 | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/ci.yml` | phase13_10_24 | Install Chromium for workspace browser regression | `npx playwright install --with-deps chromium` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.10.24 Logistics workspace projection regression | `npm run test:phase13.10.24-workspace-projection` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.10.24 Logistics workspace browser regression | `npm run test:phase13.10.24-workspace-browser` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.10.24 Marketplace fulfillment boundary regression | `npm run test:phase13.10.24-marketplace-boundary` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.11.22 current cross-pack cumulative verification gate | `node phase0/phase13.11.22-current-verification-gate.mjs` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.11.20 current historical documentation continuity | `node phase0/phase13.11.20-current-documentation-integrity-regression.mjs` |
| `.github/workflows/ci.yml` | phase13_10_24 | Phase 13.11.21 current historical snapshot and exit continuity | `node phase0/phase13.11.21-current-snapshot-exit-regression.mjs` |
| `.github/workflows/ci.yml` | phase13_10_24 | Service delivery readiness and assignment compatibility regression | `npm run test:service-catalog-http` |
| `.github/workflows/ci.yml` | phase13_10_24 | Service Booking operator workspace regression | `npm run test:service-booking-operator-workspace` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.3 declared-hours assessment regression | `npm run test:service-window-assessment` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.4 resource commitment migration regression | `npm run test:sc-03.4-resource-commitment-migration` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.5 service provider booking queue regression | `npm run test:sc-03.5-service-provider-queue` |
| `.github/workflows/ci.yml` | phase13_10_24 | Service booking standalone Appointments navigation regression | `npm run test:service-bookings-appointments-navigation` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.5 Telegram buyer appointment order isolation regression | `npm run test:sc-03.5-buyer-appointments` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.5 customer appointment browser regression | `npm run test:sc-03.5-appointments-browser` |
| `.github/workflows/ci.yml` | phase13_10_24 | SC-03.5 authenticated Telegram appointment HTTP regression | `npm run test:sc-03.5-appointments-http` |
| `.github/workflows/ci.yml` | phase13_10_24 | Service Booking operator browser regression | `node phase0/service-booking-operator-browser-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Verify runtime | `node --version` |
| `.github/workflows/ci.yml` | baseline | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/ci.yml` | baseline | Install Chromium system dependencies for outbox browser runtime regression | `npx playwright install-deps chromium` |
| `.github/workflows/ci.yml` | baseline | Install Chromium browser for outbox browser runtime regression | `npx playwright install chromium` |
| `.github/workflows/ci.yml` | baseline | Ecosystem Add menu regression | `node phase0/ecosystem-add-menu-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Inventory refresh lifecycle regression | `node phase0/inventory-refresh-lifecycle-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Inventory refresh behavior regression | `node phase0/inventory-refresh-behavior-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Outbox tenant-scope regression | `npm run test:outbox-tenant-scope` |
| `.github/workflows/ci.yml` | baseline | Order sync idempotency regression | `npm run test:order-sync-idempotency` |
| `.github/workflows/ci.yml` | baseline | B2B invoice transition concurrency regression | `npm run phase11.3:invoice-test` |
| `.github/workflows/ci.yml` | baseline | Authorization location capability projection regression | `node phase0/p1-05-scope-context-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Location scope gate regression | `npm run test:phase13.12.6` |
| `.github/workflows/ci.yml` | baseline | Restaurant payment intent authority regression | `npm run phase13.8.6:restaurant-order-payment-test` |
| `.github/workflows/ci.yml` | baseline | First-experience service catalog contract regression | `npm run test:service-catalog-contract` |
| `.github/workflows/ci.yml` | baseline | Service booking lifecycle contract regression | `npm run test:service-booking-contract` |
| `.github/workflows/ci.yml` | baseline | Service booking persistence regression | `npm run test:service-booking-persistence` |
| `.github/workflows/ci.yml` | baseline | Service Resource migration 80/81 compatibility regression | `npm run test:service-resource-migration-compatibility` |
| `.github/workflows/ci.yml` | baseline | Service booking scheduling authority boundary regression | `npm run test:service-booking-scheduling-boundary` |
| `.github/workflows/ci.yml` | baseline | SC-03.1 service resource foundation contract and UI regression | `npm run test:service-resource-foundation` |
| `.github/workflows/ci.yml` | baseline | SC-03.1 service resource SQLite persistence regression | `npm run test:service-resource-persistence` |
| `.github/workflows/ci.yml` | baseline | SC-03.3 service provider resource-scoped authorization regression | `npm run test:service-provider-resource-scope` |
| `.github/workflows/ci.yml` | baseline | First merchant-to-first-checkout HTTP journey regression | `npm run test:first-merchant-to-first-checkout` |
| `.github/workflows/ci.yml` | baseline | First-experience tenant isolation HTTP regression | `npm run test:first-experience-tenant-isolation-http` |
| `.github/workflows/ci.yml` | baseline | Customer HTTP authorization, tenant isolation, and audit provenance regression | `node phase0/customer-http-audit-provenance-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Marketplace order Payment Core bootstrap regression | `npm run test:marketplace-order-payment-bootstrap` |
| `.github/workflows/ci.yml` | baseline | First-experience service catalog frontend sync regression | `npm run test:service-catalog-frontend-sync` |
| `.github/workflows/ci.yml` | baseline | First-experience ecosystem discovery regression | `npm run test:first-experience-ecosystem-discovery` |
| `.github/workflows/ci.yml` | baseline | First-experience returning merchant regression | `npm run test:first-experience-returning-merchant` |
| `.github/workflows/ci.yml` | baseline | First-experience onboarding browser regression | `npm run test:first-experience-onboarding-browser` |
| `.github/workflows/ci.yml` | baseline | First-experience Home readiness regression | `npm run test:first-experience-home-readiness` |
| `.github/workflows/ci.yml` | baseline | First-workspace catalog activation regression | `npm run test:first-experience-workspace-activation` |
| `.github/workflows/ci.yml` | baseline | P1-13 Pack dependency readiness regression | `npm run test:p1-13` |
| `.github/workflows/ci.yml` | baseline | P1-14 Pack recovery async readiness regression | `npm run test:p1-14` |
| `.github/workflows/ci.yml` | baseline | Country-pack onboarding integrity regression | `npm run test:country-pack-onboarding` |
| `.github/workflows/ci.yml` | baseline | Offline outbox recovery journal regression | `npm run test:offline-outbox-recovery-journal` |
| `.github/workflows/ci.yml` | baseline | Offline outbox localStorage fallback race regression | `npm run test:outbox-localstorage-fallback-race` |
| `.github/workflows/ci.yml` | baseline | Offline outbox browser runtime regression | `npm run test:offline-outbox-browser-runtime` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18I payment verification migration independence regression | `npm run gap-1.18:provider-verification-migration-test` |
| `.github/workflows/ci.yml` | baseline | Database backup filename collision regression | `npm run test:backup-collision` |
| `.github/workflows/ci.yml` | baseline | Isolated SQLite backup/restore regression | `npm run test:backup-restore` |
| `.github/workflows/ci.yml` | baseline | Payment lineage append-only and cascade-blocking regression | `npm run test:payment-lineage-append-only` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18Q payment decision idempotency regression | `npm run gap-1.18:decision-idempotency-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18U financial transition idempotency regression | `npm run gap-1.18:financial-transition-idempotency-test` |
| `.github/workflows/ci.yml` | baseline | Browser module serving boundary regression | `npm run test:browser-module-serving` |
| `.github/workflows/ci.yml` | baseline | Browser module serving HTTP regression | `npm run test:browser-module-serving-http` |
| `.github/workflows/ci.yml` | baseline | Production server browser module HTTP regression | `npm run test:browser-module-serving-production-http` |
| `.github/workflows/ci.yml` | baseline | Full-app browser smoke regression (development and production servers) | `npm run test:browser-module-serving-browser` |
| `.github/workflows/ci.yml` | baseline | Syntax check core entrypoints | `|` |
| `.github/workflows/ci.yml` | baseline | J5 canonical low-stock journey regression | `npm run test:j5-canonical-low-stock-journey` |
| `.github/workflows/ci.yml` | baseline | Run baseline regression | `npm run phase0:test` |
| `.github/workflows/ci.yml` | baseline | Marketplace checkout, fulfillment, payment, and refund integrity regression | `npm run phase11.4:marketplace-test` |
| `.github/workflows/ci.yml` | baseline | Phase 17.10 cumulative procurement exit gate | `npm run test:phase17.10` |
| `.github/workflows/ci.yml` | baseline | Checkout payment-state clarity and order-total regression | `npm run test:checkout-payment-state-clarity` |
| `.github/workflows/ci.yml` | baseline | Order queue order-value labeling regression | `node phase0/order-queue-order-value-label-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | FUX-31 frontend identity regression | `npm run test:fux-31` |
| `.github/workflows/ci.yml` | baseline | Take Order sticky cart keyboard accessibility regression | `node phase0/take-order-sticky-cart-accessibility-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Home command-center attention regression | `node phase0/home-command-center-attention-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | FUX-31 accessibility source regression | `npm run test:fux-31-accessibility` |
| `.github/workflows/ci.yml` | baseline | FUX-26 seller storefront channel contract validation regression | `npm run fux26:storefront-contract-test` |
| `.github/workflows/ci.yml` | baseline | First product empty-state regression | `npm run test:first-product-empty-state` |
| `.github/workflows/ci.yml` | baseline | FUX-42 core fulfillment regression | `npm run test:fux-42` |
| `.github/workflows/ci.yml` | baseline | FUX-44 frontend fulfillment authority regression | `npm run test:fux-44` |
| `.github/workflows/ci.yml` | baseline | FUX-46 canonical inventory mutation regression | `npm run test:fux-46` |
| `.github/workflows/ci.yml` | baseline | FUX-47 canonical inventory projection regression | `npm run test:fux-47` |
| `.github/workflows/ci.yml` | baseline | FUX-48 canonical warehouse history regression | `npm run test:fux-48` |
| `.github/workflows/ci.yml` | baseline | FUX-49 legacy inventory authority regression | `npm run test:fux-49` |
| `.github/workflows/ci.yml` | baseline | FUX-50 inventory outbox replay regression | `npm run test:fux-50` |
| `.github/workflows/ci.yml` | baseline | SQLite canonical Inventory movement replay runtime regression | `npm run test:inventory-movement-replay-runtime` |
| `.github/workflows/ci.yml` | baseline | Inventory sync event authorization HTTP regression | `npm run test:inventory-sync-event-authorization-http` |
| `.github/workflows/ci.yml` | baseline | SQLite atomic Inventory movement batch regression | `npm run test:inventory-movement-batch-runtime` |
| `.github/workflows/ci.yml` | baseline | Authenticated HTTP atomic Inventory movement batch regression | `npm run test:inventory-movement-batch-http` |
| `.github/workflows/ci.yml` | baseline | Phase 10.5 Inventory ledger exact-replay compatibility regression | `node phase0/phase10.5-inventory-ledger-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | FUX-51 legacy inventory authority regression | `npm run test:fux-51` |
| `.github/workflows/ci.yml` | baseline | Restaurant Recipe SQLite persistence and tenant isolation regression | `npm run test:restaurant-recipe-persistence` |
| `.github/workflows/ci.yml` | baseline | FUX-52 cross-pack inventory authority regression | `npm run test:fux-52` |
| `.github/workflows/ci.yml` | baseline | FUX-53 B2B quotes frontend authority regression | `npm run test:fux-53` |
| `.github/workflows/ci.yml` | baseline | FUX-54 compliance frontend authority regression | `npm run test:fux-54` |
| `.github/workflows/ci.yml` | baseline | GAP-5 IAM membership/contextual role regression | `npm run test:gap-5-iam` |
| `.github/workflows/ci.yml` | baseline | FUX-55 seller storefront channel authority regression | `npm run test:fux-55` |
| `.github/workflows/ci.yml` | baseline | TG-1 Telegram storefront lifecycle regression | `npm run tg1:telegram-storefront-test` |
| `.github/workflows/ci.yml` | baseline | TG-4 Telegram buyer storefront API regression | `npm run tg4:telegram-buyer-test` |
| `.github/workflows/ci.yml` | baseline | TG-5 Telegram buyer identity regression | `npm run tg5:telegram-buyer-test` |
| `.github/workflows/ci.yml` | baseline | TG-6 Telegram checkout authority regression | `npm run tg6:telegram-checkout-test` |
| `.github/workflows/ci.yml` | baseline | TG-7 Telegram buyer orders isolation regression | `npm run tg7:telegram-buyer-orders-test` |
| `.github/workflows/ci.yml` | baseline | TG-8 Telegram fulfillment boundary regression | `npm run tg8:telegram-fulfillment-test` |
| `.github/workflows/ci.yml` | baseline | TG-10 Telegram storefront verification security regression | `npm run tg10:telegram-security-test` |
| `.github/workflows/ci.yml` | baseline | FUX-56 B2B customer pricing authority regression | `npm run test:fux-56` |
| `.github/workflows/ci.yml` | baseline | FUX-57 canonical business location management authority regression | `npm run test:fux-57` |
| `.github/workflows/ci.yml` | baseline | SC-03.5 canonical location timezone persistence regression | `npm run test:sc-03.5-location-timezone` |
| `.github/workflows/ci.yml` | baseline | SC-03.5 location-aware availability timezone regression | `npm run test:sc-03.5-location-aware-availability-timezone` |
| `.github/workflows/ci.yml` | baseline | GAP-1.10 payment concurrency and durable idempotency certification | `npm run gap-1.10:payment-concurrency-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.11 payment provider status lifecycle regression | `npm run gap-1.11:payment-status-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.12 provider-neutral payment reconciliation regression | `npm run gap-1.12:payment-reconciliation-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.13 payment failure expiration cancellation reversal regression | `npm run gap-1.13:payment-lifecycle-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.14 durable payment refund lifecycle regression | `npm run gap-1.14:payment-refund-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.15 settlement and fee model regression | `npm run gap-1.15:payment-settlement-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.16 executable payment routing regression | `npm run gap-1.16:payment-routing-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.17 payment operational timeline retry recovery manual review regression | `npm run gap-1.17:payment-operations-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.23 payment-evidence migration retry runtime regression | `npm run test:gap-1.23-migration-retry` |
| `.github/workflows/ci.yml` | baseline | GAP-1.23 provider notification identity SQLite regression | `npm run gap-1.23:provider-notification-identity-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1 provider notification Payment Core replay regression | `npm run gap-1:provider-notification-core-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 payment provider capability certification regression | `npm run gap-1.18:payment-provider-capability-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 durable provider capability evidence regression | `npm run gap-1.18:payment-provider-evidence-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 provider capability probe regression | `npm run gap-1.18:payment-provider-probe-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 provider adapter configuration regression | `npm run gap-1.18:payment-provider-config-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 provider probe transport regression | `npm run gap-1.18:payment-provider-transport-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18 provider adapter skeleton regression | `npm run gap-1.18:payment-provider-adapters-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18A payment evidence authority regression | `npm run gap-1.18:payment-evidence-authority-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18C capability certification regression | `npm run gap-1.18:capability-certification-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18D provider verification result regression | `npm run gap-1.18:provider-verification-result-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18E provider-local parser regression | `npm run gap-1.18:provider-local-parsers-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18F provider verification lifecycle regression | `npm run gap-1.18:provider-verification-lifecycle-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18G provider error taxonomy regression | `npm run gap-1.18:provider-error-taxonomy-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18H provider batch verification regression | `npm run gap-1.18:provider-batch-verification-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18I provider verification persistence regression | `npm run gap-1.18:provider-verification-persistence-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18J verification decision binding regression | `npm run gap-1.18:verification-decision-binding-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18K verification freshness regression | `npm run gap-1.18:verification-freshness-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18L payment financial invariant binding regression | `npm run gap-1.18:payment-financial-invariant-binding-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18M provider transaction uniqueness regression | `npm run gap-1.18:provider-transaction-uniqueness-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18N verification provenance regression | `npm run gap-1.18:verification-provenance-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18O audit lineage regression | `npm run gap-1.18:audit-lineage-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18AA failure/recovery semantics regression | `npm run gap-1.18:payment-failure-recovery-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18AB Payment Core security boundary regression | `npm run gap-1.18:payment-security-boundary-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18AC end-to-end invariant certification regression | `npm run gap-1.18:payment-invariant-certification-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.18AD production-readiness gate regression | `npm run gap-1.18:payment-production-readiness-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.19 production certification gate regression | `npm run gap-1.19:payment-production-certification-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.19 production certification HTTP authorization and tenant-isolation regression | `node phase0/gap-1.19-payment-production-certification-http-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | Shared HTTP response CORS and error-redaction regression | `node phase0/http-response-contract-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | GAP-1.19 Payment Core E2E certification regression | `npm run gap-1.19:payment-e2e-certification-test` |
| `.github/workflows/ci.yml` | baseline | GAP-1.19 adversarial Payment Core certification regression | `npm run gap-1.19:payment-adversarial-certification-test` |
| `.github/workflows/ci.yml` | baseline | PF-1 payment frontend contract regression | `npm run test:pf-1-payment-frontend-contract` |
| `.github/workflows/ci.yml` | baseline | PF-1 payment frontend integration regression | `npm run test:pf-1-payment-frontend-integration` |
| `.github/workflows/ci.yml` | baseline | GAP-1 manual payment evidence review decision regression | `node phase0/gap-1-provider-confirmation-finalization-regression.mjs` |
| `.github/workflows/ci.yml` | baseline | PF-1 payment frontend projection regression | `npm run test:pf-1-payment-frontend-projection` |
| `.github/workflows/ci.yml` | baseline | PF-2 payment frontend adversarial certification regression | `npm run test:pf-2-payment-frontend-adversarial` |
| `.github/workflows/ci.yml` | baseline | Payment UI stale-state regression | `npm run test:payment-ui-stale-state` |
| `.github/workflows/ci.yml` | baseline | PF-1 real frontend HTTP route and SQLite end-to-end regression | `npm run test:pf-1-payment-frontend-http-sqlite-e2e` |
| `.github/workflows/ci.yml` | baseline | L11.1 logistics scheduling contract regression | `npm run test:logistics-l11.1` |
| `.github/workflows/ci.yml` | baseline | L11.3 logistics scheduling persistence regression | `npm run test:logistics-l11.3` |
| `.github/workflows/ci.yml` | baseline | L11.4 logistics scheduling service regression | `npm run test:logistics-l11.4` |
| `.github/workflows/ci.yml` | baseline | L11.5 logistics scheduling authorization regression | `npm run test:logistics-l11.5` |
| `.github/workflows/ci.yml` | baseline | L11.6 logistics scheduling feasibility contract regression | `npm run test:logistics-l11.6` |
| `.github/workflows/ci.yml` | baseline | L11.7 logistics scheduling feasibility and evidence provenance regression | `npm run test:logistics-l11.7` |
| `.github/workflows/ci.yml` | baseline | L11 authenticated HTTP scheduling regression | `npm run test:logistics-scheduling-http` |
| `.github/workflows/ci.yml` | baseline | L11 timezone-aware scheduling UI regression | `npm run test:logistics-scheduling-ui` |
| `.github/workflows/ci.yml` | baseline | GAP-2 logistics authorization foundation regression | `npm run test:gap-2-logistics-authz` |
| `.github/workflows/ci.yml` | baseline | GAP-2 behavioral multi-location courier authorization regression | `npm run test:gap-2-courier-multi-location` |
| `.github/workflows/ci.yml` | baseline | GAP-2 delivery lifecycle and exception-resolution regression | `npm run test:gap-2-delivery-lifecycle` |
| `.github/workflows/ci.yml` | baseline | GAP-2 dispatch workload regression | `npm run test:gap-2-dispatch-workload` |
| `.github/workflows/ci.yml` | baseline | GAP-2 delivery single-read ownership and location scope regression | `npm run test:gap-2-delivery-read-scope` |
| `.github/workflows/ci.yml` | baseline | GAP-2 delivery frontend contract regression | `npm run test:gap-2-delivery-frontend` |
| `.github/workflows/ci.yml` | baseline | GAP-2 end-to-end delivery assignment certification | `npm run test:gap-2-delivery-certification` |
| `.github/workflows/ci.yml` | baseline | GAP-2.8 route and dispatch scope regression | `npm run test:gap-2-route-dispatch-scope` |
| `.github/workflows/ci.yml` | baseline | GAP-2.9 cross-feature consistency regression | `npm run test:gap-2-cross-feature-consistency` |
| `.github/workflows/ci.yml` | baseline | GAP-2.10 adversarial delivery regression | `npm run test:gap-2-adversarial-delivery` |
| `.github/workflows/ci.yml` | baseline | GAP-2.12 production readiness regression | `npm run test:gap-2-production-readiness` |
| `.github/workflows/ci.yml` | baseline | Country evidence source registry regression | `npm run test:country-evidence-source-registry` |
| `.github/workflows/ci.yml` | baseline | Phase 14 country-pack cumulative regression | `npm run test:phase14.13` |
| `.github/workflows/ci.yml` | baseline | Phase 14 country-pack final snapshot regression | `npm run test:phase14.15` |
| `.github/workflows/ci.yml` | baseline | Phase 15 cross-country expansion Node 24 certification | `npm run test:phase15.21` |
| `.github/workflows/ci.yml` | baseline | Phase 16 final platform snapshot Node 24 certification | `npm run test:phase16.14` |
| `.github/workflows/ci.yml` | baseline | Phase 19 cumulative Discovery Fabric exit certification | `npm run test:phase19.12-cumulative` |
| `.github/workflows/ci.yml` | baseline | Phase 20 cumulative Cross-Border Commerce exit certification | `npm run test:phase20.12` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Verify runtime | `node --version` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Phase 18.5 Supplier Network capacity persistence regression | `node phase0/phase18.5-supplier-network-capacity-regression.mjs` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Phase 19.5 Supplier Network federation regression | `node phase0/phase19.5-supplier-network-federation-regression.mjs` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Phase 19.7 deterministic Discovery matching regression | `npm run test:phase19.7` |
| `.github/workflows/ci.yml` | phase21_capacity_evidence | Phase 21 cumulative regression gate | `npm run test:phase21.14` |
| `.github/workflows/deployment-certification.yml` | deployment-smoke | Public deployment certification | `node phase0/deployment-certification.mjs` |
| `.github/workflows/logistics-runtime-certification.yml` | logistics-certification | Phase 16.13 Logistics provider stack cumulative regression | `npm run test:phase16.13-logistics-provider` |
| `.github/workflows/perplexity-audit.yml` | inventory-regression | Verify runtime | `node --version` |
| `.github/workflows/perplexity-audit.yml` | inventory-regression | Install dependencies | `npm ci --ignore-scripts` |
| `.github/workflows/perplexity-audit.yml` | inventory-regression | Route inventory regression | `node phase0/perplexity-route-inventory-regression.mjs` |
| `.github/workflows/perplexity-audit.yml` | inventory-regression | SQLite store inventory regression | `node phase0/perplexity-store-inventory-regression.mjs` |
| `.github/workflows/release-certification.yml` | release-certification | Runtime gate | `|` |
| `.github/workflows/release-certification.yml` | release-certification | Install | `npm ci --ignore-scripts` |
| `.github/workflows/release-certification.yml` | release-certification | P1-22 cumulative certification | `npm run test:p1-22` |
| `.github/workflows/release-certification.yml` | release-certification | P1-23 Node 24 release gate | `npm run test:p1-23` |
| `.github/workflows/release-certification.yml` | release-certification | P1-24 final snapshot | `npm run test:p1-24` |
| `.github/workflows/release-certification.yml` | release-certification | P1-25 release evidence handoff | `npm run test:p1-25` |
| `.github/workflows/release-certification.yml` | release-certification | Phase 0 release check | `npm run phase0:release-check` |
| `.github/workflows/security.yml` | source-hygiene | Reject committed local secrets and runtime state | `|` |
| `.github/workflows/supplier-network-activation-authorization.yml` | supplier_network_activation_authorization | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/supplier-network-activation-authorization.yml` | supplier_network_activation_authorization | Supplier Network activation HTTP authorization regression | `node phase0/supplier-network-activation-http-authorization-regression.mjs` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | Verify Node.js runtime | `node --version` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | Phase 21.17 capacity evidence migration regression | `node phase0/phase21.17-capacity-evidence-migration-regression.mjs` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | Phase 21.18 current capacity evidence verification | `node phase0/phase21.18-current-verification-regression.mjs` |
| `.github/workflows/supplier-network-capacity-evidence.yml` | supplier_network_capacity_evidence | Phase 21.20 Procurement RFQ capacity evidence snapshot regression | `node phase0/phase21.20-procurement-rfq-capacity-evidence-snapshot-regression.mjs` |
| `.github/workflows/supplier-network-discovery-http.yml` | supplier_network_discovery_http | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/supplier-network-discovery-http.yml` | supplier_network_discovery_http | Supplier Network discovery HTTP authorization regression | `node phase0/supplier-network-discovery-http-authorization-regression.mjs` |
| `.github/workflows/supplier-network-performance-visibility.yml` | supplier_network_performance_visibility | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/supplier-network-performance-visibility.yml` | supplier_network_performance_visibility | Supplier Network performance visibility regression | `node phase0/supplier-network-performance-visibility-regression.mjs` |
| `.github/workflows/supplier-network-trust-visibility.yml` | supplier_network_trust_visibility | Install root dependencies | `npm install --ignore-scripts` |
| `.github/workflows/supplier-network-trust-visibility.yml` | supplier_network_trust_visibility | Supplier Network trust qualification visibility regression | `node phase0/supplier-network-trust-qualification-visibility-regression.mjs` |

## Package scripts

| Script | Command | Tags | CI jobs | Test files |
|---|---|---|---|---|
| `start` | `node backend/server.js` | contract/unit | not directly mapped | — |
| `start:backend` | `npm --prefix backend start` | contract/unit | not directly mapped | — |
| `dev` | `npm --prefix backend run dev` | contract/unit | not directly mapped | — |
| `dev:backend` | `npm --prefix backend run dev` | contract/unit | not directly mapped | — |
| `dev:app` | `npm --prefix app run dev` | contract/unit | not directly mapped | — |
| `backup` | `npm --prefix backend run backup` | contract/unit | not directly mapped | — |
| `phase0:baseline` | `bash scripts/phase0-baseline.sh` | contract/unit | not directly mapped | — |
| `phase0:test` | `node phase0/golden-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/golden-regression.mjs |
| `test:first-product-empty-state` | `node phase0/first-product-empty-state-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/first-product-empty-state-regression.mjs |
| `phase0:release-check` | `bash scripts/phase0-release-check.sh` | release | .github/workflows/release-certification.yml:release-certification | — |
| `phase10.7:compliance-test` | `node phase0/phase10.7-compliance-regression.mjs` | contract/unit | not directly mapped | phase0/phase10.7-compliance-regression.mjs |
| `phase11.1:money-test` | `node phase0/phase11.1-money-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.1-money-regression.mjs |
| `phase11.2:payment-test` | `node phase0/phase11.2-payment-regression.mjs` | integration | not directly mapped | phase0/phase11.2-payment-regression.mjs |
| `phase11.2:provider-test` | `node phase0/phase11.2-provider-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.2-provider-regression.mjs |
| `phase11.3:b2b-test` | `node phase0/phase11.3-b2b-custom-pricing-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.3-b2b-custom-pricing-regression.mjs |
| `phase11.3:quotes-test` | `node phase0/phase11.3-b2b-quotes-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.3-b2b-quotes-regression.mjs |
| `phase11.3:po-test` | `node phase0/phase11.3-b2b-po-approval-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.3-b2b-po-approval-regression.mjs |
| `phase11.3:credit-test` | `node phase0/phase11.3-b2b-credit-terms-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.3-b2b-credit-terms-regression.mjs |
| `phase11.3:ar-test` | `node phase0/phase11.3-b2b-ar-regression.mjs` | contract/unit | not directly mapped | phase0/phase11.3-b2b-ar-regression.mjs |
| `phase11.3:invoice-test` | `node phase0/phase11.3-b2b-invoice-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase11.3-b2b-invoice-regression.mjs |
| `phase11.4:marketplace-test` | `node phase0/phase11.4-marketplace-integrity-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/phase11.4-marketplace-integrity-regression.mjs |
| `phase17.1:procurement-demand-test` | `node phase0/phase17.1-procurement-demand-regression.mjs` | integration | not directly mapped | phase0/phase17.1-procurement-demand-regression.mjs |
| `phase17.1:procurement-demand-contract-test` | `node phase0/phase17.1-procurement-demand-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.1-procurement-demand-contract-regression.mjs |
| `phase17.2:procurement-supplier-test` | `node phase0/phase17.2-supplier-participation-regression.mjs` | integration | not directly mapped | phase0/phase17.2-supplier-participation-regression.mjs |
| `phase17.2:procurement-supplier-contract-test` | `node phase0/phase17.2-supplier-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.2-supplier-contract-regression.mjs |
| `phase17.3:procurement-rfq-test` | `node phase0/phase17.3-rfq-response-regression.mjs` | integration | not directly mapped | phase0/phase17.3-rfq-response-regression.mjs |
| `phase17.3:procurement-rfq-contract-test` | `node phase0/phase17.3-rfq-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.3-rfq-contract-regression.mjs |
| `phase17.4:procurement-comparison-test` | `node phase0/phase17.4-comparison-regression.mjs` | integration | not directly mapped | phase0/phase17.4-comparison-regression.mjs |
| `phase17.4:procurement-comparison-contract-test` | `node phase0/phase17.4-comparison-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.4-comparison-contract-regression.mjs |
| `phase17.5:procurement-award-test` | `node phase0/phase17.5-procurement-award-regression.mjs` | integration | not directly mapped | phase0/phase17.5-procurement-award-regression.mjs |
| `phase17.5:procurement-award-contract-test` | `node phase0/phase17.5-procurement-award-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.5-procurement-award-contract-regression.mjs |
| `phase17.6:procurement-po-bridge-test` | `node phase0/phase17.6-procurement-po-bridge-regression.mjs` | integration | not directly mapped | phase0/phase17.6-procurement-po-bridge-regression.mjs |
| `phase17.6:execution-contract-test` | `node phase0/phase17.6-execution-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.6-execution-contract-regression.mjs |
| `phase12.1:physical-printing-test` | `node phase0/phase12.1-physical-printing-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.1-physical-printing-regression.mjs |
| `phase12.2:fulfillment-test` | `node phase0/phase12.2-fulfillment-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.2-fulfillment-bridge-regression.mjs |
| `phase12.3:lifecycle-test` | `node phase0/phase12.3-physical-lifecycle-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.3-physical-lifecycle-regression.mjs |
| `phase12.4:printing-contract-test` | `node phase0/phase12.4-printing-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.4-printing-contract-regression.mjs |
| `phase12.5:escpos-test` | `node phase0/phase12.5-escpos-adapter-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.5-escpos-adapter-regression.mjs |
| `phase12.6:web-bluetooth-test` | `node phase0/phase12.6-web-bluetooth-adapter-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.6-web-bluetooth-adapter-regression.mjs |
| `phase12.7:warehouse-test` | `node phase0/phase12.7-warehouse-hardening-regression.mjs` | contract/unit | not directly mapped | phase0/phase12.7-warehouse-hardening-regression.mjs |
| `phase12.8:regression-gate` | `node phase0/phase12.8-regression-gate.mjs` | contract/unit | not directly mapped | phase0/phase12.8-regression-gate.mjs |
| `phase13.1:vertical-pack-test` | `node phase0/phase13.1-vertical-pack-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.1-vertical-pack-contract-regression.mjs |
| `phase13.2:agriculture-test` | `node phase0/phase13.2-agriculture-foundation-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.2-agriculture-foundation-regression.mjs |
| `phase13.3:agriculture-identity-test` | `node phase0/phase13.3-agriculture-identity-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.3-agriculture-identity-bridge-regression.mjs |
| `phase13.4:agriculture-farm-plot-test` | `node phase0/phase13.4-agriculture-farm-plot-model-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.4-agriculture-farm-plot-model-regression.mjs |
| `phase13.5:agriculture-inventory-test` | `node phase0/phase13.5-agriculture-inventory-bridge-regression.mjs` | integration | not directly mapped | phase0/phase13.5-agriculture-inventory-bridge-regression.mjs |
| `phase13.6:agriculture-commerce-test` | `node phase0/phase13.6-agriculture-commerce-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.6-agriculture-commerce-bridge-regression.mjs |
| `phase13.7:agriculture-procurement-test` | `node phase0/phase13.7-agriculture-procurement-bridge-regression.mjs` | integration | not directly mapped | phase0/phase13.7-agriculture-procurement-bridge-regression.mjs |
| `phase13.8.1:restaurant-boundary-test` | `node phase0/phase13.8.1-restaurant-pack-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.8.1-restaurant-pack-boundary-regression.mjs |
| `phase13.8.2:restaurant-tables-test` | `node phase0/phase13.8.2-restaurant-tables-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.8.2-restaurant-tables-integration-regression.mjs |
| `phase13.8.3:restaurant-kitchen-test` | `node phase0/phase13.8.3-restaurant-kitchen-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.8.3-restaurant-kitchen-integration-regression.mjs |
| `phase13.8.4:restaurant-recipe-test` | `node phase0/phase13.8.4-restaurant-recipe-ingredient-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.8.4-restaurant-recipe-ingredient-regression.mjs |
| `test:restaurant-recipe-persistence` | `node phase0/restaurant-recipe-persistence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/restaurant-recipe-persistence-regression.mjs |
| `phase13.8.5:restaurant-inventory-test` | `node phase0/phase13.8.5-restaurant-inventory-consumption-regression.mjs` | integration | not directly mapped | phase0/phase13.8.5-restaurant-inventory-consumption-regression.mjs |
| `phase13.8.6:restaurant-order-payment-test` | `node phase0/phase13.8.6-restaurant-order-payment-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/phase13.8.6-restaurant-order-payment-regression.mjs |
| `phase13.8.7:restaurant-regression` | `node phase0/phase13.8.7-restaurant-regression-gate.mjs` | contract/unit | not directly mapped | phase0/phase13.8.7-restaurant-regression-gate.mjs |
| `phase13.9.1:warehouse-boundary-test` | `node phase0/phase13.9.1-warehouse-pack-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.1-warehouse-pack-boundary-regression.mjs |
| `test:phase13.9.2` | `node phase0/phase13.9.2-warehouse-authority-map-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.2-warehouse-authority-map-regression.mjs |
| `test:phase13.9.3` | `node phase0/phase13.9.3-warehouse-existing-module-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.3-warehouse-existing-module-boundary-regression.mjs |
| `test:phase13.9.4` | `node phase0/phase13.9.4-warehouse-inventory-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.4-warehouse-inventory-bridge-regression.mjs |
| `test:phase13.9.5` | `node phase0/phase13.9.5-warehouse-location-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.5-warehouse-location-bridge-regression.mjs |
| `test:phase13.9.6` | `node phase0/phase13.9.6-warehouse-fulfillment-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.6-warehouse-fulfillment-boundary-regression.mjs |
| `test:phase13.9.7` | `node phase0/phase13.9.7-warehouse-receiving-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.7-warehouse-receiving-contract-regression.mjs |
| `test:phase13.9.8` | `node phase0/phase13.9.8-warehouse-stock-adjustment-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.8-warehouse-stock-adjustment-contract-regression.mjs |
| `test:phase13.9.9` | `node phase0/phase13.9.9-warehouse-configuration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.9-warehouse-configuration-regression.mjs |
| `test:phase13.9.10` | `node phase0/phase13.9.10-warehouse-targeted-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.10-warehouse-targeted-regression.mjs |
| `test:phase13.9.11` | `node phase0/phase13.9.11-warehouse-adversarial-idempotency-isolation-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.11-warehouse-adversarial-idempotency-isolation-regression.mjs |
| `test:phase13.9.12` | `node phase0/phase13.9.12-warehouse-legacy-bin-compatibility-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.9.12-warehouse-legacy-bin-compatibility-regression.mjs |
| `test:phase13.9.13` | `node phase0/phase13.9.13-warehouse-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase13.9.13-warehouse-cumulative-gate.mjs |
| `test:phase13.9.14` | `node phase0/phase13.9.14-node24-verification.mjs` | contract/unit | not directly mapped | phase0/phase13.9.14-node24-verification.mjs |
| `phase13.10.1:logistics-boundary-test` | `node phase0/phase13.10.1-logistics-pack-boundary-regression.mjs` | integration | not directly mapped | phase0/phase13.10.1-logistics-pack-boundary-regression.mjs |
| `test:phase13.10.2` | `node phase0/phase13.10.2-logistics-authority-map-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.2-logistics-authority-map-regression.mjs |
| `test:phase13.10.3` | `node phase0/phase13.10.3-logistics-fulfillment-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.3-logistics-fulfillment-boundary-regression.mjs |
| `test:phase13.10.4` | `node phase0/phase13.10.4-logistics-proof-return-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.4-logistics-proof-return-regression.mjs |
| `test:phase13.10.5` | `node phase0/phase13.10.5-logistics-configuration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.5-logistics-configuration-regression.mjs |
| `test:phase13.10.6` | `node phase0/phase13.10.6-logistics-adversarial-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.6-logistics-adversarial-regression.mjs |
| `test:phase13.10.7` | `node phase0/phase13.10.7-logistics-regression-gate.mjs` | contract/unit | not directly mapped | phase0/phase13.10.7-logistics-regression-gate.mjs |
| `test:phase13.10.8` | `node phase0/phase13.10.8-baseline-relock-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.8-baseline-relock-regression.mjs |
| `test:phase13.10.9` | `node phase0/phase13.10.9-logistics-shipment-tracking-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.9-logistics-shipment-tracking-regression.mjs |
| `test:phase13.10.10` | `node phase0/phase13.10.10-logistics-proof-capture-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.10-logistics-proof-capture-regression.mjs |
| `test:phase13.10.11` | `node phase0/phase13.10.11-logistics-returns-workflow-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.11-logistics-returns-workflow-regression.mjs |
| `test:phase13.10.12` | `node phase0/phase13.10.12-logistics-courier-assignment-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.12-logistics-courier-assignment-regression.mjs |
| `test:phase13.10.13` | `node phase0/phase13.10.13-logistics-routes-scope-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.13-logistics-routes-scope-regression.mjs |
| `test:phase13.10.14` | `node phase0/phase13.10.14-logistics-cross-feature-adversarial-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.14-logistics-cross-feature-adversarial-regression.mjs |
| `test:phase13.10.15` | `node phase0/phase13.10.15-logistics-cumulative-gate.mjs` | contract/unit | .github/workflows/ci.yml:logistics_exit_certification | phase0/phase13.10.15-logistics-cumulative-gate.mjs |
| `test:phase13.10.16` | `node phase0/phase13.10.16-node24-verification.mjs` | contract/unit | not directly mapped | phase0/phase13.10.16-node24-verification.mjs |
| `test:phase13.11.0` | `node phase0/phase13.11.0-cross-pack-baseline-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.0-cross-pack-baseline-regression.mjs |
| `test:phase13.11.3` | `node phase0/phase13.11.3-physical-commerce-spine-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.3-physical-commerce-spine-regression.mjs |
| `test:phase13.11.4` | `node phase0/phase13.11.4-warehouse-inventory-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.4-warehouse-inventory-integration-regression.mjs |
| `test:phase13.11.5` | `node phase0/phase13.11.5-restaurant-commerce-inventory-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.5-restaurant-commerce-inventory-regression.mjs |
| `test:phase13.11.6` | `node phase0/phase13.11.6-agriculture-commerce-inventory-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.6-agriculture-commerce-inventory-regression.mjs |
| `test:phase13.11.7` | `node phase0/phase13.11.7-agriculture-warehouse-logistics-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.7-agriculture-warehouse-logistics-regression.mjs |
| `test:phase13.11.8` | `node phase0/phase13.11.8-restaurant-warehouse-logistics-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.8-restaurant-warehouse-logistics-regression.mjs |
| `test:phase13.11.9` | `node phase0/phase13.11.9-unified-fulfillment-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.9-unified-fulfillment-regression.mjs |
| `test:phase13.11.10` | `node phase0/phase13.11.10-event-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.10-event-boundary-regression.mjs |
| `test:outbox-tenant-scope` | `node phase0/event-outbox-tenant-scope-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/event-outbox-tenant-scope-regression.mjs |
| `test:order-sync-idempotency` | `node phase0/order-sync-idempotency-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/order-sync-idempotency-regression.mjs |
| `test:service-catalog-contract` | `node phase0/first-experience-service-catalog-contract-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/first-experience-service-catalog-contract-regression.mjs |
| `test:service-booking-contract` | `node phase0/service-booking-contract-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-booking-contract-regression.mjs |
| `test:service-booking-persistence` | `node phase0/service-booking-persistence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-booking-persistence-regression.mjs |
| `test:service-resource-migration-compatibility` | `node phase0/service-resource-migration-80-81-compatibility-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-resource-migration-80-81-compatibility-regression.mjs |
| `test:service-booking-scheduling-boundary` | `node phase0/service-booking-scheduling-authority-boundary-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-booking-scheduling-authority-boundary-regression.mjs |
| `test:service-resource-foundation` | `node phase0/service-resource-foundation-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-resource-foundation-regression.mjs |
| `test:service-resource-persistence` | `node phase0/service-resource-persistence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/service-resource-persistence-regression.mjs |
| `test:service-provider-resource-scope` | `node phase0/service-provider-resource-scope-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/service-provider-resource-scope-regression.mjs |
| `test:sc-03.4-resource-commitment-migration` | `node phase0/sc-03.4-resource-commitment-migration-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/sc-03.4-resource-commitment-migration-regression.mjs |
| `test:sc-03.5-service-provider-queue` | `node phase0/sc-03.5-service-provider-booking-queue-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/sc-03.5-service-provider-booking-queue-regression.mjs |
| `test:service-bookings-appointments-navigation` | `node phase0/service-bookings-appointments-navigation-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/service-bookings-appointments-navigation-regression.mjs |
| `test:sc-03.5-buyer-appointments` | `node phase0/sc-03.5-buyer-appointment-order-regression.mjs` | contract/unit | .github/workflows/ci.yml:phase13_10_24 | phase0/sc-03.5-buyer-appointment-order-regression.mjs |
| `test:sc-03.5-appointments-browser` | `node phase0/sc-03.5-customer-appointments-browser-regression.mjs` | e2e | .github/workflows/ci.yml:phase13_10_24 | phase0/sc-03.5-customer-appointments-browser-regression.mjs |
| `test:sc-03.5-appointments-http` | `node phase0/sc-03.5-telegram-appointments-http-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/sc-03.5-telegram-appointments-http-regression.mjs |
| `test:phase13.11.11` | `node phase0/phase13.11.11-idempotency-replay-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.11-idempotency-replay-regression.mjs |
| `test:phase13.11.12` | `node phase0/phase13.11.12-failure-isolation-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.12-failure-isolation-regression.mjs |
| `test:phase13.11.13` | `node phase0/phase13.11.13-cancellation-returns-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.13-cancellation-returns-regression.mjs |
| `test:phase13.11.14` | `node phase0/phase13.11.14-authorization-tenant-isolation-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.14-authorization-tenant-isolation-regression.mjs |
| `test:phase13.11.15` | `node phase0/phase13.11.15-audit-observability-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.15-audit-observability-regression.mjs |
| `test:phase13.11.16` | `node phase0/phase13.11.16-adversarial-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.16-adversarial-regression.mjs |
| `test:phase13.11.17` | `node phase0/phase13.11.17-architecture-lint.mjs` | contract/unit | not directly mapped | phase0/phase13.11.17-architecture-lint.mjs |
| `test:phase13.11.18` | `node phase0/phase13.11.18-integration-matrix-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.18-integration-matrix-regression.mjs |
| `test:phase13.11.19` | `node phase0/phase13.11.19-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase13.11.19-cumulative-gate.mjs |
| `test:phase13.11.20` | `node phase0/phase13.11.20-documentation-hash-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.20-documentation-hash-regression.mjs |
| `test:phase13.11.21` | `node phase0/phase13.11.21-snapshot-exit-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.11.21-snapshot-exit-regression.mjs |
| `test:phase13.12.0` | `node phase0/phase13.12.0-security-gate-baseline-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.0-security-gate-baseline-regression.mjs |
| `test:phase13.12.1` | `node phase0/phase13.12.1-authorization-authority-inventory-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.1-authorization-authority-inventory-regression.mjs |
| `test:phase13.12.2` | `node phase0/phase13.12.2-security-context-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.2-security-context-contract-regression.mjs |
| `test:phase13.12.3` | `node phase0/phase13.12.3-resource-action-registry-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.3-resource-action-registry-regression.mjs |
| `test:phase13.12.4` | `node phase0/phase13.12.4-cross-pack-role-matrix-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.4-cross-pack-role-matrix-regression.mjs |
| `test:phase13.12.5` | `node phase0/phase13.12.5-organization-isolation-gate-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.5-organization-isolation-gate-regression.mjs |
| `test:phase13.12.6` | `node phase0/phase13.12.6-location-scope-gate-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase13.12.6-location-scope-gate-regression.mjs |
| `test:phase13.12.7` | `node phase0/phase13.12.7-vertical-capability-authorization-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.7-vertical-capability-authorization-regression.mjs |
| `test:phase13.12.8` | `node phase0/phase13.12.8-mutation-enforcement-gate-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.8-mutation-enforcement-gate-regression.mjs |
| `test:phase13.12.9` | `node phase0/phase13.12.9-approval-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.9-approval-boundary-regression.mjs |
| `test:phase13.12.10` | `node phase0/phase13.12.10-sensitive-action-audit-gate-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.10-sensitive-action-audit-gate-regression.mjs |
| `test:phase13.12.11` | `node phase0/phase13.12.11-api-boundary-attack-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.11-api-boundary-attack-regression.mjs |
| `test:phase13.12.12` | `node phase0/phase13.12.12-cross-pack-escalation-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.12-cross-pack-escalation-regression.mjs |
| `test:phase13.12.13` | `node phase0/phase13.12.13-pack-configuration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.13-pack-configuration-regression.mjs |
| `test:phase13.12.14` | `node phase0/phase13.12.14-events-outbox-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.14-events-outbox-integration-regression.mjs |
| `test:phase13.12.15` | `node phase0/phase13.12.15-phase13-regression-gate.mjs` | contract/unit | not directly mapped | phase0/phase13.12.15-phase13-regression-gate.mjs |
| `test:phase13.12.16` | `node phase0/phase13.12.16-node24-full-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.12.16-node24-full-regression.mjs |
| `test:phase13.12.17` | `node phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs` | contract/unit | not directly mapped | phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs |
| `test:phase14.1` | `node phase0/phase14.1-country-pack-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.1-country-pack-contract-regression.mjs |
| `test:phase14.2` | `node phase0/phase14.2-ethiopia-pack-identity-locale-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.2-ethiopia-pack-identity-locale-regression.mjs |
| `test:phase14.3` | `node phase0/phase14.3-country-currency-money-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.3-country-currency-money-regression.mjs |
| `test:phase14.4` | `node phase0/phase14.4-tax-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.4-tax-boundary-regression.mjs |
| `test:phase14.5` | `node phase0/phase14.5-document-invoice-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.5-document-invoice-boundary-regression.mjs |
| `test:phase14.6` | `node phase0/phase14.6-phone-address-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.6-phone-address-regression.mjs |
| `test:phase14.7` | `node phase0/phase14.7-ethiopia-payment-adapter-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.7-ethiopia-payment-adapter-regression.mjs |
| `test:phase14.8` | `node phase0/phase14.8-ethiopia-compliance-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.8-ethiopia-compliance-boundary-regression.mjs |
| `test:phase14.9` | `node phase0/phase14.9-country-configuration-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.9-country-configuration-regression.mjs |
| `test:phase14.12` | `node phase0/phase14.12-ethiopia-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.12-ethiopia-integration-regression.mjs |
| `test:phase14.0` | `node phase0/phase14.0-country-pack-baseline-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.0-country-pack-baseline-regression.mjs |
| `test:phase14.11` | `node phase0/phase14.11-country-events-outbox-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.11-country-events-outbox-regression.mjs |
| `test:phase14.13` | `node phase0/phase14.13-cross-country-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase14.13-cross-country-regression.mjs |
| `test:phase14.14` | `node phase0/phase14.14-node24-regression.mjs` | contract/unit | not directly mapped | phase0/phase14.14-node24-regression.mjs |
| `test:phase14.15` | `node phase0/phase14.15-final-snapshot-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase14.15-final-snapshot-regression.mjs |
| `test:phase15.0` | `node phase0/phase15.0-country-pack-expansion-baseline-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.0-country-pack-expansion-baseline-regression.mjs |
| `test:phase15.5` | `node phase0/phase15.5-regional-cluster-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.5-regional-cluster-contract-regression.mjs |
| `test:phase15.7` | `node phase0/phase15.7-tanzania-country-identity-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.7-tanzania-country-identity-regression.mjs |
| `test:phase15.6` | `node phase0/phase15.6-country-priority-sequencing-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.6-country-priority-sequencing-regression.mjs |
| `test:phase15.9` | `node phase0/phase15.9-cemac-regional-expansion-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.9-cemac-regional-expansion-regression.mjs |
| `test:phase15.16` | `node phase0/phase15.16-compliance-expansion-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.16-compliance-expansion-regression.mjs |
| `test:phase15.17` | `node phase0/phase15.17-country-security-expansion-regression.mjs` | contract/unit | not directly mapped | phase0/phase15.17-country-security-expansion-regression.mjs |
| `test:phase15.20` | `node phase0/phase15.20-cross-country-regression-gate.mjs` | contract/unit | not directly mapped | phase0/phase15.20-cross-country-regression-gate.mjs |
| `test:country-pack-onboarding` | `node phase0/country-pack-onboarding-integrity-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/country-pack-onboarding-integrity-regression.mjs |
| `test:phase15.21` | `node phase0/phase15.21-node24-full-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase15.21-node24-full-regression.mjs |
| `test:phase16.0` | `node phase0/phase16.0-platform-baseline-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.0-platform-baseline-regression.mjs |
| `test:phase16.1` | `node phase0/phase16.1-canonical-capability-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.1-canonical-capability-contract-regression.mjs |
| `test:phase16.2` | `node phase0/phase16.2-authority-registry-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.2-authority-registry-regression.mjs |
| `test:phase16.3` | `node phase0/phase16.3-adapter-framework-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.3-adapter-framework-regression.mjs |
| `test:phase16.4` | `node phase0/phase16.4-integration-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.4-integration-contract-regression.mjs |
| `test:phase16.5` | `node phase0/phase16.5-capability-discovery-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.5-capability-discovery-regression.mjs |
| `test:phase16.6` | `node phase0/phase16.6-contract-versioning-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.6-contract-versioning-regression.mjs |
| `test:phase16.7` | `node phase0/phase16.7-event-outbox-platformization-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.7-event-outbox-platformization-regression.mjs |
| `test:phase16.8` | `node phase0/phase16.8-integration-gateway-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.8-integration-gateway-regression.mjs |
| `test:phase16.9` | `node phase0/phase16.9-tenant-country-vertical-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.9-tenant-country-vertical-regression.mjs |
| `test:phase16.10` | `node phase0/phase16.10-ai-capability-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.10-ai-capability-boundary-regression.mjs |
| `test:phase16.11` | `node phase0/phase16.11-platform-security-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.11-platform-security-regression.mjs |
| `test:phase16.12` | `node phase0/phase16.12-platform-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.12-platform-regression.mjs |
| `test:phase16.13` | `node phase0/phase16.13-node24-certification.mjs` | contract/unit | not directly mapped | phase0/phase16.13-node24-certification.mjs |
| `test:phase16.13-logistics-provider` | `node phase0/phase16.13-logistics-provider-cumulative-regression.mjs` | integration | .github/workflows/logistics-runtime-certification.yml:logistics-certification | phase0/phase16.13-logistics-provider-cumulative-regression.mjs |
| `test:phase16.14` | `node phase0/phase16.14-final-platform-snapshot.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase16.14-final-platform-snapshot.mjs |
| `phase17.3:rfq-contract-test` | `node phase0/phase17.3-rfq-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.3-rfq-contract-regression.mjs |
| `phase17.3:rfq-response-test` | `node phase0/phase17.3-rfq-response-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.3-rfq-response-regression.mjs |
| `phase17.4:comparison-test` | `node phase0/phase17.4-comparison-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.4-comparison-regression.mjs |
| `phase17.4:comparison-contract-test` | `node phase0/phase17.4-comparison-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.4-comparison-contract-regression.mjs |
| `phase17.8:payment-contract-test` | `node phase0/phase17.8-payment-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.8-payment-contract-regression.mjs |
| `phase17.8:procurement-payment-test` | `node phase0/phase17.8-procurement-payment-regression.mjs` | integration | not directly mapped | phase0/phase17.8-procurement-payment-regression.mjs |
| `phase17.7:procurement-receiving-test` | `node phase0/phase17.7-procurement-receiving-regression.mjs` | integration | not directly mapped | phase0/phase17.7-procurement-receiving-regression.mjs |
| `phase17.7:receiving-contract-test` | `node phase0/phase17.7-receiving-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase17.7-receiving-contract-regression.mjs |
| `phase17.9:procurement-settlement-test` | `node phase0/phase17.9-procurement-settlement-regression.mjs` | integration | not directly mapped | phase0/phase17.9-procurement-settlement-regression.mjs |
| `phase17.9:procurement-settlement-contract-test` | `node phase0/phase17.9-procurement-settlement-contract-regression.mjs` | integration | not directly mapped | phase0/phase17.9-procurement-settlement-contract-regression.mjs |
| `test:pf-1-payment-frontend-contract` | `node phase0/gap-pf-1-payment-frontend-contract-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-pf-1-payment-frontend-contract-regression.mjs |
| `test:pf-1-payment-frontend-integration` | `node phase0/gap-pf-1-payment-frontend-integration-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-pf-1-payment-frontend-integration-regression.mjs |
| `test:pf-1-payment-frontend-projection` | `node phase0/gap-pf-1-payment-frontend-projection-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-pf-1-payment-frontend-projection-regression.mjs |
| `test:checkout-payment-state-clarity` | `node phase0/checkout-payment-state-clarity-regression.mjs` | e2e, integration | .github/workflows/ci.yml:baseline | phase0/checkout-payment-state-clarity-regression.mjs |
| `test:payment-ui-stale-state` | `node phase0/payment-ui-stale-state-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/payment-ui-stale-state-regression.mjs |
| `test:pf-2-payment-frontend-adversarial` | `node phase0/gap-pf-2-payment-frontend-adversarial-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/gap-pf-2-payment-frontend-adversarial-regression.mjs |
| `test:phase17.10` | `node phase0/phase17.10-cumulative-exit-gate.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase17.10-cumulative-exit-gate.mjs |
| `phase18.1:supplier-network-profile-test` | `node phase0/phase18.1-supplier-network-profile-regression.mjs` | integration | not directly mapped | phase0/phase18.1-supplier-network-profile-regression.mjs |
| `phase18.2:supplier-network-capability-test` | `node phase0/phase18.2-supplier-network-capability-regression.mjs` | integration | not directly mapped | phase0/phase18.2-supplier-network-capability-regression.mjs |
| `phase18.3:supplier-network-catalog-test` | `node phase0/phase18.3-supplier-network-catalog-regression.mjs` | integration | not directly mapped | phase0/phase18.3-supplier-network-catalog-regression.mjs |
| `phase18.4:service-area-test` | `node phase0/phase18.4-supplier-network-service-area-regression.mjs` | integration | not directly mapped | phase0/phase18.4-supplier-network-service-area-regression.mjs |
| `phase18.6:commercial-test` | `node phase0/phase18.6-supplier-network-commercial-regression.mjs` | contract/unit | not directly mapped | phase0/phase18.6-supplier-network-commercial-regression.mjs |
| `phase18.7:qualification-test` | `node phase0/phase18.7-supplier-network-qualification-regression.mjs` | contract/unit | not directly mapped | phase0/phase18.7-supplier-network-qualification-regression.mjs |
| `test:phase18.7` | `node phase0/phase18.7-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase18.7-cumulative-gate.mjs |
| `phase18.8:performance-test` | `node phase0/phase18.8-supplier-network-performance-regression.mjs` | contract/unit | not directly mapped | phase0/phase18.8-supplier-network-performance-regression.mjs |
| `phase18.10:discovery-test` | `node phase0/phase18.10-supplier-network-discovery-regression.mjs` | contract/unit | not directly mapped | phase0/phase18.10-supplier-network-discovery-regression.mjs |
| `test:phase18.10` | `node phase0/phase18.10-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase18.10-cumulative-gate.mjs |
| `test:phase18.8` | `node phase0/phase18.8-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase18.8-cumulative-gate.mjs |
| `phase18.11:marketplace-integration-test` | `node phase0/phase18.11-supplier-network-marketplace-integration-regression.mjs` | integration | not directly mapped | phase0/phase18.11-supplier-network-marketplace-integration-regression.mjs |
| `test:phase18.11` | `node phase0/phase18.11-cumulative-gate.mjs` | contract/unit | not directly mapped | phase0/phase18.11-cumulative-gate.mjs |
| `test:phase18.12` | `node phase0/phase18.12-cumulative-exit-gate.mjs` | contract/unit | not directly mapped | phase0/phase18.12-cumulative-exit-gate.mjs |
| `test:phase19.2` | `node phase0/phase19.2-discovery-provider-registry-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.2-discovery-provider-registry-regression.mjs |
| `test:phase19.3` | `node phase0/phase19.3-cross-marketplace-product-discovery-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.3-cross-marketplace-product-discovery-regression.mjs |
| `test:phase19.4` | `node phase0/phase19.4-seller-organization-discovery-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.4-seller-organization-discovery-regression.mjs |
| `test:phase19.5` | `node phase0/phase19.5-supplier-network-federation-regression.mjs` | contract/unit | .github/workflows/ci.yml:phase21_capacity_evidence | phase0/phase19.5-supplier-network-federation-regression.mjs |
| `test:phase19.6` | `node phase0/phase19.6-market-context-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.6-market-context-regression.mjs |
| `test:phase19.7` | `node phase0/phase19.7-deterministic-matching-regression.mjs` | contract/unit | .github/workflows/ci.yml:phase21_capacity_evidence | phase0/phase19.7-deterministic-matching-regression.mjs |
| `test:phase19.8` | `node phase0/phase19.8-explainable-ranking-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.8-explainable-ranking-regression.mjs |
| `test:phase19.9` | `node phase0/phase19.9-opportunity-model-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.9-opportunity-model-regression.mjs |
| `test:phase19.10` | `node phase0/phase19.10-unified-discovery-api-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.10-unified-discovery-api-regression.mjs |
| `test:phase19.11` | `node phase0/phase19.11-ai-intent-translation-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.11-ai-intent-translation-boundary-regression.mjs |
| `test:phase19.11-cumulative` | `node phase0/phase19.11-cumulative-gate.mjs` | release | not directly mapped | phase0/phase19.11-cumulative-gate.mjs |
| `test:phase19.12` | `node phase0/phase19.12-full-ecosystem-discovery-exit-regression.mjs` | contract/unit | not directly mapped | phase0/phase19.12-full-ecosystem-discovery-exit-regression.mjs |
| `test:phase19.12-cumulative` | `node phase0/phase19.12-cumulative-exit-gate.mjs` | release | .github/workflows/ci.yml:baseline | phase0/phase19.12-cumulative-exit-gate.mjs |
| `test:phase20.1` | `node phase0/phase20.1-cross-border-contract-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.1-cross-border-contract-regression.mjs |
| `test:phase20.4` | `node phase0/phase20.4-country-interface-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.4-country-interface-regression.mjs |
| `test:phase20.5` | `node phase0/phase20.5-currency-context-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.5-currency-context-regression.mjs |
| `test:phase20.6` | `node phase0/phase20.6-cross-border-commercial-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.6-cross-border-commercial-regression.mjs |
| `test:phase20.7` | `node phase0/phase20.7-trade-requirements-evidence-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.7-trade-requirements-evidence-regression.mjs |
| `test:phase20.8` | `node phase0/phase20.8-cross-border-logistics-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.8-cross-border-logistics-regression.mjs |
| `test:phase20.9` | `node phase0/phase20.9-cross-border-evaluation-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.9-cross-border-evaluation-regression.mjs |
| `test:phase20.10` | `node phase0/phase20.10-cross-border-plan-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.10-cross-border-plan-regression.mjs |
| `test:phase20.11` | `node phase0/phase20.11-cross-border-ai-intent-regression.mjs` | contract/unit | not directly mapped | phase0/phase20.11-cross-border-ai-intent-regression.mjs |
| `test:phase20.12` | `node phase0/phase20.12-cumulative-exit-gate.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/phase20.12-cumulative-exit-gate.mjs |
| `test:phase21.0` | `node phase0/phase21.0-baseline-relock-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.0-baseline-relock-regression.mjs |
| `test:phase21.1` | `node phase0/phase21.1-commodity-supply-boundary-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.1-commodity-supply-boundary-regression.mjs |
| `test:phase21.2` | `node phase0/phase21.2-supply-capability-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.2-supply-capability-regression.mjs |
| `test:phase21.3` | `node phase0/phase21.3-capacity-availability-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.3-capacity-availability-regression.mjs |
| `test:phase21.4` | `node phase0/phase21.4-demand-requirement-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.4-demand-requirement-regression.mjs |
| `test:phase21.5` | `node phase0/phase21.5-deterministic-commodity-match-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.5-deterministic-commodity-match-regression.mjs |
| `test:phase21.6` | `node phase0/phase21.6-sourcing-opportunity-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.6-sourcing-opportunity-regression.mjs |
| `test:phase21.7` | `node phase0/phase21.7-supply-gap-alternative-sourcing-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.7-supply-gap-alternative-sourcing-regression.mjs |
| `test:phase21.8` | `node phase0/phase21.8-discovery-ranking-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.8-discovery-ranking-integration-regression.mjs |
| `test:phase21.9` | `node phase0/phase21.9-procurement-commerce-handoff-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.9-procurement-commerce-handoff-regression.mjs |
| `test:phase21.10` | `node phase0/phase21.10-agriculture-supply-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.10-agriculture-supply-integration-regression.mjs |
| `test:phase21.11` | `node phase0/phase21.11-cross-border-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.11-cross-border-integration-regression.mjs |
| `test:phase21.12` | `node phase0/phase21.12-network-intelligence-control-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.12-network-intelligence-control-regression.mjs |
| `test:phase21.13` | `node phase0/phase21.13-adversarial-idempotency-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.13-adversarial-idempotency-regression.mjs |
| `test:phase21.14` | `node phase0/phase21.14-cumulative-phase21-gate.mjs` | contract/unit | .github/workflows/ci.yml:phase21_capacity_evidence | phase0/phase21.14-cumulative-phase21-gate.mjs |
| `test:phase21.15` | `node phase0/phase21.15-node24-verification.mjs` | contract/unit | not directly mapped | phase0/phase21.15-node24-verification.mjs |
| `test:phase21.16` | `node phase0/phase21.16-hashes-documentation-regression.mjs` | contract/unit | not directly mapped | phase0/phase21.16-hashes-documentation-regression.mjs |
| `test:phase21.17` | `node phase0/phase21.17-capacity-evidence-migration-regression.mjs` | contract/unit | .github/workflows/supplier-network-capacity-evidence.yml:supplier_network_capacity_evidence | phase0/phase21.17-capacity-evidence-migration-regression.mjs |
| `test:phase22.2` | `node phase0/phase22.2-procurement-intent-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.2-procurement-intent-regression.mjs |
| `test:phase22.3` | `node phase0/phase22.3-procurement-context-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.3-procurement-context-regression.mjs |
| `test:phase22.4` | `node phase0/phase22.4-evidence-supplier-intelligence-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.4-evidence-supplier-intelligence-regression.mjs |
| `test:phase22.5` | `node phase0/phase22.5-procurement-preparation-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.5-procurement-preparation-regression.mjs |
| `test:phase22.6` | `node phase0/phase22.6-deterministic-result-explanation-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.6-deterministic-result-explanation-regression.mjs |
| `test:phase22.7` | `node phase0/phase22.7-action-proposal-authorization-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.7-action-proposal-authorization-regression.mjs |
| `test:phase22.9` | `node phase0/phase22.9-adversarial-idempotency-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.9-adversarial-idempotency-regression.mjs |
| `test:phase22.10` | `node phase0/phase22.10-cumulative-phase22-gate.mjs` | contract/unit | not directly mapped | phase0/phase22.10-cumulative-phase22-gate.mjs |
| `test:phase22.11` | `node phase0/phase22.11-node24-verification.mjs` | contract/unit | not directly mapped | phase0/phase22.11-node24-verification.mjs |
| `test:phase22.12` | `node phase0/phase22.12-hashes-documentation-regression.mjs` | contract/unit | not directly mapped | phase0/phase22.12-hashes-documentation-regression.mjs |
| `tg1:telegram-storefront-test` | `node phase0/tg1-telegram-storefront-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg1-telegram-storefront-regression.mjs |
| `tg2:telegram-byob-test` | `node phase0/tg2-telegram-byob-regression.mjs` | e2e | not directly mapped | phase0/tg2-telegram-byob-regression.mjs |
| `tg4:telegram-buyer-test` | `node phase0/tg4-telegram-buyer-storefront-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg4-telegram-buyer-storefront-regression.mjs |
| `tg5:telegram-buyer-test` | `node phase0/tg5-telegram-buyer-identity-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg5-telegram-buyer-identity-regression.mjs |
| `tg6:telegram-checkout-test` | `node phase0/tg6-telegram-checkout-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg6-telegram-checkout-regression.mjs |
| `tg7:telegram-buyer-orders-test` | `node phase0/tg7-telegram-buyer-orders-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg7-telegram-buyer-orders-regression.mjs |
| `tg8:telegram-fulfillment-test` | `node phase0/tg8-telegram-fulfillment-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/tg8-telegram-fulfillment-regression.mjs |
| `tg10:telegram-security-test` | `node phase0/tg10-telegram-security-cumulative-regression.mjs` | security, e2e | .github/workflows/ci.yml:baseline | phase0/tg10-telegram-security-cumulative-regression.mjs |
| `fux26:storefront-contract-test` | `node phase0/fux26-storefront-channel-contract-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/fux26-storefront-channel-contract-regression.mjs |
| `fux28:cross-channel-test` | `node phase0/fux28-cross-channel-consistency-regression.mjs` | contract/unit | not directly mapped | phase0/fux28-cross-channel-consistency-regression.mjs |
| `fux29:seller-golden-journey-test` | `node phase0/fux29-seller-golden-journey-regression.mjs` | e2e | not directly mapped | phase0/fux29-seller-golden-journey-regression.mjs |
| `fux30:multi-channel-adversarial-test` | `node phase0/fux30-multi-channel-adversarial-regression.mjs` | security | not directly mapped | phase0/fux30-multi-channel-adversarial-regression.mjs |
| `test:p1-22` | `node phase0/p1-22-pack-cumulative-certification.mjs` | contract/unit | .github/workflows/release-certification.yml:release-certification | phase0/p1-22-pack-cumulative-certification.mjs |
| `test:p1-23` | `node phase0/p1-23-node24-runtime-gate.mjs` | contract/unit | .github/workflows/release-certification.yml:release-certification | phase0/p1-23-node24-runtime-gate.mjs |
| `test:p1-24` | `node phase0/p1-24-p1-final-snapshot.mjs` | contract/unit | .github/workflows/release-certification.yml:release-certification | phase0/p1-24-p1-final-snapshot.mjs |
| `test:p1-25` | `node phase0/p1-25-final-release-evidence-handoff.mjs` | contract/unit | .github/workflows/release-certification.yml:release-certification | phase0/p1-25-final-release-evidence-handoff.mjs |
| `fux14:device-test` | `node phase0/fux14-device-hardware-regression.mjs` | contract/unit | not directly mapped | phase0/fux14-device-hardware-regression.mjs |
| `fux17-18:notifications-observability-test` | `node phase0/fux17-18-notifications-observability-regression.mjs` | contract/unit | not directly mapped | phase0/fux17-18-notifications-observability-regression.mjs |
| `fux19-20:experimentation-analytics-test` | `node phase0/fux19-20-experimentation-analytics-regression.mjs` | contract/unit | not directly mapped | phase0/fux19-20-experimentation-analytics-regression.mjs |
| `fux21-23:qa-security-recovery-test` | `node phase0/fux21-23-qa-security-recovery-regression.mjs` | security | not directly mapped | phase0/fux21-23-qa-security-recovery-regression.mjs |
| `fux24:documentation-test` | `node phase0/fux24-in-product-documentation-regression.mjs` | contract/unit | not directly mapped | phase0/fux24-in-product-documentation-regression.mjs |
| `fux25:certification` | `node phase0/fux25-final-certification.mjs` | release | not directly mapped | phase0/fux25-final-certification.mjs |
| `fux13.2:pack-lifecycle-persistence-test` | `node phase0/fux13-pack-lifecycle-persistence-regression.mjs` | integration | not directly mapped | phase0/fux13-pack-lifecycle-persistence-regression.mjs |
| `fux13:pack-lifecycle-experience-test` | `node phase0/fux13-pack-lifecycle-experience-regression.mjs` | contract/unit | not directly mapped | phase0/fux13-pack-lifecycle-experience-regression.mjs |
| `test:p0-09` | `node phase0/p0-09-procurement-demand-rfq-preparation-regression.mjs` | contract/unit | not directly mapped | phase0/p0-09-procurement-demand-rfq-preparation-regression.mjs |
| `test:p0-10` | `node phase0/p0-10-rfq-responses-comparison-regression.mjs` | contract/unit | not directly mapped | phase0/p0-10-rfq-responses-comparison-regression.mjs |
| `test:p0-11` | `node phase0/p0-11-comparison-award-authorization-regression.mjs` | contract/unit | not directly mapped | phase0/p0-11-comparison-award-authorization-regression.mjs |
| `test:p0-12` | `node phase0/p0-12-award-po-receiving-regression.mjs` | contract/unit | not directly mapped | phase0/p0-12-award-po-receiving-regression.mjs |
| `test:p0-golden-cumulative` | `node phase0/p0-golden-journey-cumulative-gate.mjs` | release | not directly mapped | phase0/p0-golden-journey-cumulative-gate.mjs |
| `test:fux-31` | `node phase0/fux-31-frontend-identity-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-31-frontend-identity-regression.mjs |
| `test:fux-31-accessibility` | `node phase0/fux-31-accessibility-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-31-accessibility-regression.mjs |
| `test:fux-42` | `node phase0/fux-42-core-fulfillment-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-42-core-fulfillment-regression.mjs |
| `test:fux-44` | `node phase0/fux-44-fulfillment-frontend-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-44-fulfillment-frontend-authority-regression.mjs |
| `test:fux-46` | `node phase0/fux-46-canonical-inventory-mutation-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-46-canonical-inventory-mutation-regression.mjs |
| `test:fux-47` | `node phase0/fux-47-canonical-inventory-projection-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-47-canonical-inventory-projection-regression.mjs |
| `test:j5-canonical-low-stock-journey` | `node phase0/j5-canonical-low-stock-journey-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/j5-canonical-low-stock-journey-regression.mjs |
| `test:fux-48` | `node phase0/fux-48-canonical-warehouse-history-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-48-canonical-warehouse-history-regression.mjs |
| `test:fux-49` | `node phase0/fux-49-legacy-inventory-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-49-legacy-inventory-authority-regression.mjs |
| `test:fux-50` | `node phase0/fux-50-inventory-outbox-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-50-inventory-outbox-regression.mjs |
| `test:inventory-movement-replay-runtime` | `node phase0/inventory-movement-replay-runtime-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/inventory-movement-replay-runtime-regression.mjs |
| `test:inventory-sync-event-authorization-http` | `node phase0/inventory-sync-event-authorization-http-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/inventory-sync-event-authorization-http-regression.mjs |
| `test:inventory-movement-batch-runtime` | `node phase0/inventory-movement-batch-runtime-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/inventory-movement-batch-runtime-regression.mjs |
| `test:inventory-movement-batch-http` | `node phase0/inventory-movement-batch-http-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/inventory-movement-batch-http-regression.mjs |
| `test:fux-51` | `node phase0/fux-51-legacy-inventory-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-51-legacy-inventory-authority-regression.mjs |
| `test:fux-52` | `node phase0/fux-52-cross-pack-inventory-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-52-cross-pack-inventory-authority-regression.mjs |
| `test:fux-53` | `node phase0/fux-53-b2b-quotes-frontend-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-53-b2b-quotes-frontend-authority-regression.mjs |
| `test:fux-54` | `node phase0/fux-54-compliance-frontend-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-54-compliance-frontend-authority-regression.mjs |
| `test:fux-55` | `node phase0/fux-55-seller-storefront-channel-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-55-seller-storefront-channel-authority-regression.mjs |
| `test:fux-56` | `node phase0/fux-56-b2b-customer-pricing-frontend-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-56-b2b-customer-pricing-frontend-authority-regression.mjs |
| `test:fux-57` | `node phase0/fux-57-canonical-location-management-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/fux-57-canonical-location-management-regression.mjs |
| `test:sc-03.5-location-timezone` | `node phase0/sc-03.5-location-timezone-persistence-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/sc-03.5-location-timezone-persistence-regression.mjs |
| `test:sc-03.5-location-aware-availability-timezone` | `node phase0/sc-03.5-location-aware-availability-timezone-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/sc-03.5-location-aware-availability-timezone-regression.mjs |
| `test:gap-2-logistics-authz` | `node phase0/gap-2-logistics-authorization-foundation-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/gap-2-logistics-authorization-foundation-regression.mjs |
| `test:gap-2-delivery-assignment` | `node phase0/gap-2-delivery-assignment-authority-regression.mjs` | contract/unit | .github/workflows/ci.yml:logistics_l18 | phase0/gap-2-delivery-assignment-authority-regression.mjs |
| `test:gap-2-delivery-lifecycle` | `node phase0/gap-2-delivery-assignment-lifecycle-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-delivery-assignment-lifecycle-regression.mjs |
| `test:gap-2-delivery-exception` | `node phase0/gap-2-delivery-assignment-lifecycle-regression.mjs` | contract/unit | not directly mapped | phase0/gap-2-delivery-assignment-lifecycle-regression.mjs |
| `test:gap-2-reassignment-auth` | `node phase0/gap-2-reassignment-auth-regression.mjs` | security | not directly mapped | phase0/gap-2-reassignment-auth-regression.mjs |
| `test:gap-2-courier-multi-location` | `node phase0/gap-2-courier-multi-location-behavioral-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-courier-multi-location-behavioral-regression.mjs |
| `test:gap-2-dispatch-workload` | `node phase0/gap-2-dispatch-workload-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-dispatch-workload-regression.mjs |
| `test:gap-2-delivery-read-scope` | `node phase0/gap-2-delivery-read-scope-regression.mjs` | security | .github/workflows/ci.yml:baseline | phase0/gap-2-delivery-read-scope-regression.mjs |
| `test:gap-2-delivery-frontend` | `node phase0/gap-2-delivery-frontend-contract-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-delivery-frontend-contract-regression.mjs |
| `gap-1.10:payment-concurrency-test` | `node phase0/gap-1.10-payment-concurrency-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.10-payment-concurrency-regression.mjs |
| `gap-1.11:payment-status-test` | `node phase0/gap-1.11-payment-provider-status-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.11-payment-provider-status-regression.mjs |
| `gap-1.12:payment-reconciliation-test` | `node phase0/gap-1.12-payment-reconciliation-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.12-payment-reconciliation-regression.mjs |
| `gap-1.13:payment-lifecycle-test` | `node phase0/gap-1.13-payment-lifecycle-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.13-payment-lifecycle-regression.mjs |
| `gap-1.14:payment-refund-test` | `node phase0/gap-1.14-payment-refund-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.14-payment-refund-regression.mjs |
| `gap-1.15:payment-settlement-test` | `node phase0/gap-1.15-payment-settlement-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.15-payment-settlement-regression.mjs |
| `gap-1.16:payment-routing-test` | `node phase0/gap-1.16-payment-routing-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.16-payment-routing-regression.mjs |
| `gap-1.17:payment-operations-test` | `node phase0/gap-1.17-payment-operations-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.17-payment-operations-regression.mjs |
| `gap-1.18:payment-provider-capability-test` | `node phase0/gap-1.18-payment-provider-capability-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-payment-provider-capability-regression.mjs |
| `gap-1.18:payment-provider-evidence-test` | `node phase0/gap-1.18-provider-capability-evidence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-capability-evidence-regression.mjs |
| `gap-1.18:payment-provider-probe-test` | `node phase0/gap-1.18-provider-capability-probe-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-capability-probe-regression.mjs |
| `gap-1.18:payment-provider-config-test` | `node phase0/gap-1.18-provider-adapter-config-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-adapter-config-regression.mjs |
| `gap-1.18:payment-provider-transport-test` | `node phase0/gap-1.18-provider-probe-transport-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-probe-transport-regression.mjs |
| `gap-1.18:payment-provider-adapters-test` | `node phase0/gap-1.18-provider-adapters-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-adapters-regression.mjs |
| `gap-1.18:payment-evidence-authority-test` | `node phase0/gap-1.18A-payment-evidence-authority-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18A-payment-evidence-authority-regression.mjs |
| `gap-1.18:capability-certification-test` | `node phase0/gap-1.18C-capability-certification-regression.mjs` | release | .github/workflows/ci.yml:baseline | phase0/gap-1.18C-capability-certification-regression.mjs |
| `gap-1.18:provider-verification-result-test` | `node phase0/gap-1.18-provider-verification-result-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-verification-result-regression.mjs |
| `gap-1.18:provider-local-parsers-test` | `node phase0/gap-1.18-provider-local-parsers-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-local-parsers-regression.mjs |
| `gap-1.18:provider-verification-lifecycle-test` | `node phase0/gap-1.18-provider-verification-lifecycle-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-verification-lifecycle-regression.mjs |
| `gap-1.18:provider-error-taxonomy-test` | `node phase0/gap-1.18-provider-error-taxonomy-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18-provider-error-taxonomy-regression.mjs |
| `gap-1:provider-transaction-correlation-test` | `node phase0/gap-1-provider-transaction-confirmation-correlation-regression.mjs` | contract/unit | not directly mapped | phase0/gap-1-provider-transaction-confirmation-correlation-regression.mjs |
| `gap-1:provider-notification-core-test` | `node phase0/gap-1-provider-notification-payment-core-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1-provider-notification-payment-core-regression.mjs |
| `gap-1.23:provider-notification-identity-test` | `node phase0/gap-1.23-provider-notification-identity-sqlite-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.23-provider-notification-identity-sqlite-regression.mjs |
| `test:gap-1.23-migration-retry` | `node phase0/gap-1.23-migration-retry-runtime-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.23-migration-retry-runtime-regression.mjs |
| `gap-1:provider-confirmation-finalization-test` | `node phase0/gap-1-provider-confirmation-finalization-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1-provider-confirmation-finalization-regression.mjs |
| `gap-1.18:provider-batch-verification-test` | `node phase0/gap-1.18H-provider-batch-verification-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18H-provider-batch-verification-regression.mjs |
| `gap-1.18:provider-verification-persistence-test` | `node phase0/gap-1.18I-provider-verification-persistence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18I-provider-verification-persistence-regression.mjs |
| `gap-1.18:provider-verification-migration-test` | `node phase0/gap-1.18I-migration-independence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18I-migration-independence-regression.mjs |
| `gap-1.18:verification-decision-binding-test` | `node phase0/gap-1.18J-verification-decision-binding-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18J-verification-decision-binding-regression.mjs |
| `gap-1.18:verification-freshness-test` | `node phase0/gap-1.18K-verification-freshness-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18K-verification-freshness-regression.mjs |
| `gap-1.18:payment-financial-invariant-binding-test` | `node phase0/gap-1.18L-payment-financial-invariant-binding-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18L-payment-financial-invariant-binding-regression.mjs |
| `gap-1.18:provider-transaction-uniqueness-test` | `node phase0/gap-1.18M-provider-transaction-uniqueness-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18M-provider-transaction-uniqueness-regression.mjs |
| `gap-1.18:verification-provenance-test` | `node phase0/gap-1.18N-verification-provenance-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18N-verification-provenance-regression.mjs |
| `gap-1.18:audit-lineage-test` | `node phase0/gap-1.18O-audit-lineage-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18O-audit-lineage-regression.mjs |
| `gap-1.18:payment-failure-recovery-test` | `node phase0/gap-1.18AA-payment-failure-recovery-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18AA-payment-failure-recovery-regression.mjs |
| `gap-1.18:payment-security-boundary-test` | `node phase0/gap-1.18AB-payment-security-boundary-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18AB-payment-security-boundary-regression.mjs |
| `gap-1.18:payment-invariant-certification-test` | `node phase0/gap-1.18AC-payment-invariant-certification-regression.mjs` | release, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18AC-payment-invariant-certification-regression.mjs |
| `gap-1.18:payment-production-readiness-test` | `node phase0/gap-1.18AD-production-readiness-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/gap-1.18AD-production-readiness-regression.mjs |
| `gap-1.19:payment-production-certification-test` | `node phase0/gap-1.19-production-certification-gate-regression.mjs` | release, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.19-production-certification-gate-regression.mjs |
| `gap-1.19:payment-e2e-certification-test` | `node phase0/gap-1.19-payment-e2e-certification-regression.mjs` | e2e, release, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.19-payment-e2e-certification-regression.mjs |
| `gap-1.19:payment-adversarial-certification-test` | `node phase0/gap-1.19-payment-adversarial-certification-regression.mjs` | security, release, integration | .github/workflows/ci.yml:baseline | phase0/gap-1.19-payment-adversarial-certification-regression.mjs |
| `test:gap-2-delivery-certification` | `node phase0/gap-2-delivery-end-to-end-certification-regression.mjs` | release | .github/workflows/ci.yml:baseline | phase0/gap-2-delivery-end-to-end-certification-regression.mjs |
| `test:gap-2-route-dispatch-scope` | `node phase0/gap-2-route-dispatch-scope-regression.mjs` | security | .github/workflows/ci.yml:baseline | phase0/gap-2-route-dispatch-scope-regression.mjs |
| `test:gap-2-cross-feature-consistency` | `node phase0/gap-2-cross-feature-consistency-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-cross-feature-consistency-regression.mjs |
| `test:gap-2-adversarial-delivery` | `node phase0/gap-2-adversarial-delivery-regression.mjs` | security | .github/workflows/ci.yml:baseline | phase0/gap-2-adversarial-delivery-regression.mjs |
| `test:gap-2-production-readiness` | `node phase0/gap-2-production-readiness-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-2-production-readiness-regression.mjs |
| `test:pf-1-final-certification` | `node phase0/gap-pf-1J-final-certification.mjs` | release | not directly mapped | phase0/gap-pf-1J-final-certification.mjs |
| `test:pf-1k-frontend-payment-lifecycle` | `node phase0/gap-pf-1K-frontend-payment-lifecycle.mjs` | integration | not directly mapped | phase0/gap-pf-1K-frontend-payment-lifecycle.mjs |
| `test:pf-1-payment-frontend-http-sqlite-e2e` | `node phase0/gap-pf-1L-payment-frontend-http-sqlite-e2e-regression.mjs` | e2e, integration | .github/workflows/ci.yml:baseline | phase0/gap-pf-1L-payment-frontend-http-sqlite-e2e-regression.mjs |
| `test:phase13.10.17` | `node phase0/phase13.10.17-logistics-pack-productization-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.17-logistics-pack-productization-regression.mjs |
| `test:phase13.10.18` | `node phase0/phase13.10.18-logistics-workspace-composition-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.18-logistics-workspace-composition-regression.mjs |
| `test:phase13.10.19` | `node phase0/phase13.10.19-logistics-movement-shipment-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.19-logistics-movement-shipment-regression.mjs |
| `test:phase13.10.20` | `node phase0/phase13.10.20-logistics-tracking-evidence-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.20-logistics-tracking-evidence-regression.mjs |
| `test:phase13.10.21` | `node phase0/phase13.10.21-logistics-workspace-projection-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.21-logistics-workspace-projection-regression.mjs |
| `test:phase13.10.22` | `node phase0/phase13.10.22-logistics-workspace-ui-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.22-logistics-workspace-ui-integration-regression.mjs |
| `test:phase13.10.23` | `node phase0/phase13.10.23-logistics-operational-surfaces-regression.mjs` | contract/unit | not directly mapped | phase0/phase13.10.23-logistics-operational-surfaces-regression.mjs |
| `test:phase16.13.10` | `node phase0/phase16.13.10-logistics-provider-matching-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.10-logistics-provider-matching-regression.mjs |
| `test:phase16.13.11` | `node phase0/phase16.13.11-logistics-network-integration-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.11-logistics-network-integration-regression.mjs |
| `test:phase16.13.12` | `node phase0/phase16.13.12-logistics-provider-execution-bridge-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.12-logistics-provider-execution-bridge-regression.mjs |
| `test:phase16.13.13` | `node phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs |
| `test:phase16.13.14` | `node phase0/phase16.13.14-logistics-provider-execution-service-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.14-logistics-provider-execution-service-regression.mjs |
| `test:phase16.13.15` | `node phase0/phase16.13.15-logistics-provider-execution-runtime-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.15-logistics-provider-execution-runtime-regression.mjs |
| `test:phase16.13.16` | `node phase0/phase16.13.16-logistics-provider-deployment-adapter-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.16-logistics-provider-deployment-adapter-regression.mjs |
| `test:phase16.13.17` | `node phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs |
| `test:phase16.13.18` | `node phase0/phase16.13.18-logistics-provider-callback-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.18-logistics-provider-callback-regression.mjs |
| `test:phase16.13.19` | `node phase0/phase16.13.19-logistics-provider-callback-application-regression.mjs` | contract/unit | not directly mapped | phase0/phase16.13.19-logistics-provider-callback-application-regression.mjs |
| `test:logistics-l11.1` | `node phase0/logistics-scheduling-contract-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-contract-regression.mjs |
| `test:logistics-l11.3` | `node phase0/logistics-scheduling-persistence-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-persistence-regression.mjs |
| `test:logistics-l11.4` | `node phase0/logistics-scheduling-service-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-service-regression.mjs |
| `test:logistics-l11.5` | `node phase0/logistics-scheduling-authorization-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-authorization-regression.mjs |
| `test:logistics-l11.6` | `node phase0/logistics-scheduling-feasibility-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-feasibility-regression.mjs |
| `test:logistics-l11.7` | `node phase0/logistics-scheduling-feasibility-service-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-feasibility-service-regression.mjs |
| `test:logistics-l11.8` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-scheduling-http` | `node phase0/logistics-scheduling-http-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-http-regression.mjs |
| `test:logistics-scheduling-ui` | `node phase0/logistics-scheduling-ui-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/logistics-scheduling-ui-regression.mjs |
| `test:logistics-l11.8-l11.9` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.10` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.11` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.12` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.13` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.14` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.15` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l11.16` | `node phase0/logistics-scheduling-decision-regression.mjs` | integration | not directly mapped | phase0/logistics-scheduling-decision-regression.mjs |
| `test:logistics-l12` | `node phase0/logistics-evidence-profile-regression.mjs` | integration | not directly mapped | phase0/logistics-evidence-profile-regression.mjs |
| `test:logistics-l13` | `node phase0/logistics-multi-leg-movement-regression.mjs` | integration | not directly mapped | phase0/logistics-multi-leg-movement-regression.mjs |
| `test:logistics-l14` | `node phase0/logistics-hub-depot-regression.mjs` | integration | not directly mapped | phase0/logistics-hub-depot-regression.mjs |
| `test:logistics-l15` | `node phase0/logistics-regional-freight-regression.mjs` | integration | not directly mapped | phase0/logistics-regional-freight-regression.mjs |
| `test:logistics-l16` | `node phase0/logistics-b2b-distribution-regression.mjs` | integration | not directly mapped | phase0/logistics-b2b-distribution-regression.mjs |
| `test:logistics-l17` | `node phase0/logistics-b2c-delivery-regression.mjs` | integration | not directly mapped | phase0/logistics-b2c-delivery-regression.mjs |
| `test:logistics-l18` | `node phase0/logistics-p2p-delivery-regression.mjs` | integration | .github/workflows/ci.yml:logistics_l18 | phase0/logistics-p2p-delivery-regression.mjs |
| `test:logistics-service-delivery-model` | `node phase0/logistics-service-delivery-model-contract-regression.mjs` | integration | .github/workflows/ci.yml:logistics_l18 | phase0/logistics-service-delivery-model-contract-regression.mjs |
| `test:fulfillment-queued-target-reconciliation` | `node phase0/fulfillment-queued-target-reconciliation-regression.mjs` | contract/unit | .github/workflows/ci.yml:logistics_l18 | phase0/fulfillment-queued-target-reconciliation-regression.mjs |
| `test:logistics-l19` | `node phase0/logistics-dynamic-capacity-utilization-regression.mjs` | integration | not directly mapped | phase0/logistics-dynamic-capacity-utilization-regression.mjs |
| `test:logistics-l20.1` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.2` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.3` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.4` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.5` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.6` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.7` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.8` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.9` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l20.10` | `node phase0/logistics-network-corridor-intelligence-regression.mjs` | integration | not directly mapped | phase0/logistics-network-corridor-intelligence-regression.mjs |
| `test:logistics-l21.1` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.2` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.3` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.4` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.5` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.6` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.7` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.8` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.9` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.10` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l21.11` | `node phase0/logistics-external-network-expansion-regression.mjs` | integration | not directly mapped | phase0/logistics-external-network-expansion-regression.mjs |
| `test:logistics-l8` | `node phase0/logistics-demand-profile-regression.mjs` | integration | not directly mapped | phase0/logistics-demand-profile-regression.mjs |
| `test:logistics-l9` | `node phase0/logistics-capacity-profile-regression.mjs` | integration | not directly mapped | phase0/logistics-capacity-profile-regression.mjs |
| `test:logistics-l8-l10` | `node phase0/logistics-l8-l10-demand-capacity-matching-regression.mjs` | integration | not directly mapped | phase0/logistics-l8-l10-demand-capacity-matching-regression.mjs |
| `test:logistics-l8-l21` | `node phase0/logistics-l8-l21-cumulative-exit-gate.mjs` | integration | not directly mapped | phase0/logistics-l8-l21-cumulative-exit-gate.mjs |
| `test:logistics-l8-l21-certification` | `node phase0/logistics-l8-l21-final-certification.mjs` | release, integration | .github/workflows/ci.yml:logistics_exit_certification | phase0/logistics-l8-l21-final-certification.mjs |
| `test:logistics-master-exit` | `node phase0/logistics-master-specification-exit-audit.mjs` | release, integration | .github/workflows/ci.yml:logistics_exit_certification | phase0/logistics-master-specification-exit-audit.mjs |
| `test:gap-5-iam` | `node phase0/gap-5-iam-membership-contextual-role-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-5-iam-membership-contextual-role-regression.mjs |
| `test:backup-collision` | `node phase0/database-backup-collision-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/database-backup-collision-regression.mjs |
| `test:backup-restore` | `node phase0/database-backup-restore-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/database-backup-restore-regression.mjs |
| `test:payment-lineage-append-only` | `node phase0/payment-lineage-append-only-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/payment-lineage-append-only-regression.mjs |
| `gap-1.18:decision-idempotency-test` | `node phase0/gap-1.18Q-payment-decision-idempotency-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18Q-payment-decision-idempotency-regression.mjs |
| `gap-1.18:financial-transition-idempotency-test` | `node phase0/gap-1.18U-financial-transition-idempotency-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/gap-1.18U-financial-transition-idempotency-regression.mjs |
| `test:service-catalog-http` | `node phase0/first-experience-service-catalog-http-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/first-experience-service-catalog-http-regression.mjs |
| `test:service-catalog-frontend-sync` | `node phase0/first-experience-service-catalog-frontend-sync-regression.mjs && node phase0/business-template-persistence-regression.mjs && node phase0/offering-starter-templates-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/first-experience-service-catalog-frontend-sync-regression.mjs, phase0/business-template-persistence-regression.mjs, phase0/offering-starter-templates-regression.mjs |
| `test:offline-outbox-recovery-journal` | `node phase0/offline-outbox-recovery-journal-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/offline-outbox-recovery-journal-regression.mjs |
| `test:first-experience-returning-merchant` | `node phase0/first-experience-returning-merchant-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/first-experience-returning-merchant-regression.mjs |
| `test:first-experience-add-availability` | `node phase0/first-experience-add-availability-regression.mjs` | contract/unit | not directly mapped | phase0/first-experience-add-availability-regression.mjs |
| `test:first-experience-home-readiness` | `node phase0/first-experience-home-readiness-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/first-experience-home-readiness-regression.mjs |
| `test:first-experience-pack-readiness` | `node phase0/first-experience-pack-readiness-regression.mjs` | contract/unit | not directly mapped | phase0/first-experience-pack-readiness-regression.mjs |
| `test:first-experience-channel-compatibility` | `node phase0/first-experience-channel-compatibility-regression.mjs` | contract/unit | not directly mapped | phase0/first-experience-channel-compatibility-regression.mjs |
| `test:first-experience-ecosystem-discovery` | `node phase0/first-experience-ecosystem-discovery-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/first-experience-ecosystem-discovery-regression.mjs |
| `test:browser-module-serving` | `node phase0/browser-module-serving-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/browser-module-serving-regression.mjs |
| `test:browser-module-serving-http` | `node phase0/browser-module-serving-http-regression.mjs` | e2e, integration | .github/workflows/ci.yml:baseline | phase0/browser-module-serving-http-regression.mjs |
| `test:browser-module-serving-production-http` | `node phase0/browser-module-serving-production-http-regression.mjs` | e2e, integration | .github/workflows/ci.yml:baseline | phase0/browser-module-serving-production-http-regression.mjs |
| `test:browser-module-serving-browser` | `node phase0/browser-module-serving-browser-smoke.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/browser-module-serving-browser-smoke.mjs |
| `test:gap-2-inventory-exactly-once` | `node phase0/gap-2-inventory-exactly-once-regression.mjs` | integration | not directly mapped | phase0/gap-2-inventory-exactly-once-regression.mjs |
| `test:phase13.10.24-workspace-projection` | `node phase0/phase13.10.24-logistics-workspace-projection-regression.mjs` | contract/unit | .github/workflows/ci.yml:phase13_10_24 | phase0/phase13.10.24-logistics-workspace-projection-regression.mjs |
| `test:phase13.10.24-workspace-browser` | `node phase0/phase13.10.24-logistics-workspace-browser-regression.mjs` | e2e | .github/workflows/ci.yml:phase13_10_24 | phase0/phase13.10.24-logistics-workspace-browser-regression.mjs |
| `test:phase13.10.24-marketplace-fulfillment` | `node phase0/phase11.4-marketplace-integrity-regression.mjs` | integration | not directly mapped | phase0/phase11.4-marketplace-integrity-regression.mjs |
| `test:phase13.10.24-marketplace-boundary` | `node phase0/phase13.10.24-marketplace-fulfillment-boundary-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/phase13.10.24-marketplace-fulfillment-boundary-regression.mjs |
| `test:offline-outbox-browser-runtime` | `node phase0/offline-outbox-browser-runtime.mjs` | e2e, integration | .github/workflows/ci.yml:baseline | phase0/offline-outbox-browser-runtime.mjs |
| `test:outbox-localstorage-fallback-race` | `node phase0/outbox-localstorage-fallback-race-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/outbox-localstorage-fallback-race-regression.mjs |
| `test:service-booking-operator-workspace` | `node phase0/service-booking-operator-workspace-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/service-booking-operator-workspace-regression.mjs |
| `test:service-window-assessment` | `node phase0/service-window-assessment-regression.mjs` | integration | .github/workflows/ci.yml:phase13_10_24 | phase0/service-window-assessment-regression.mjs |
| `test:first-merchant-to-first-checkout` | `node phase0/first-merchant-to-first-checkout-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/first-merchant-to-first-checkout-regression.mjs |
| `test:first-experience-tenant-isolation-http` | `node phase0/first-experience-tenant-isolation-http-regression.mjs` | security, integration | .github/workflows/ci.yml:baseline | phase0/first-experience-tenant-isolation-http-regression.mjs |
| `test:first-experience-onboarding-browser` | `node phase0/first-experience-onboarding-browser-regression.mjs` | e2e | .github/workflows/ci.yml:baseline | phase0/first-experience-onboarding-browser-regression.mjs |
| `test:marketplace-order-payment-bootstrap` | `node phase0/marketplace-order-payment-bootstrap-regression.mjs` | integration | .github/workflows/ci.yml:baseline | phase0/marketplace-order-payment-bootstrap-regression.mjs |
| `test:p1-13` | `node phase0/p1-13-pack-dependency-readiness-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/p1-13-pack-dependency-readiness-regression.mjs |
| `test:first-experience-workspace-activation` | `node phase0/first-experience-workspace-activation-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/first-experience-workspace-activation-regression.mjs |
| `test:country-evidence-source-registry` | `node phase0/country-evidence-source-registry-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/country-evidence-source-registry-regression.mjs |
| `test:service-availability-contract` | `node phase0/service-availability-contract-regression.mjs` | integration | not directly mapped | phase0/service-availability-contract-regression.mjs |
| `test:service-availability-api` | `node phase0/service-availability-api-regression.mjs` | integration | not directly mapped | phase0/service-availability-api-regression.mjs |
| `test:p1-14` | `node phase0/p1-14-pack-recovery-regression.mjs` | contract/unit | .github/workflows/ci.yml:baseline | phase0/p1-14-pack-recovery-regression.mjs |

## Source-hash dependencies

- Repository tree contains **186** SHA-256 manifest files by the current inventory.
- GitHub code search found **156** manifests that include a hash entry for `package.json`.
- This includes historical snapshots. It does **not** mean all 156 manifests are actively recomputed by CI.
- Current explicit recomputation gates and historical continuity tests are distinguished in the JSON inventory.
- Adding scripts to `package.json` changes its content hash. Before proposing an edit, identify the current active manifest(s) that recompute the package hash and preserve historical manifests unchanged.

## Non-destructive wrapper proposal (not implemented)

Do not delete or rename existing scripts. After the active hash dependencies are reconciled, add thin suite wrappers that call existing scripts only:

- `npm run test`: fast contract/unit baseline plus selected smoke checks.
- `npm run test:integration`: existing SQLite/API/HTTP/integration commands.
- `npm run test:security`: existing authorization, tenant isolation, adversarial, and privacy regressions.
- `npm run test:e2e`: browser and end-to-end journey tests, with Playwright prerequisites explicit.
- `npm run test:release`: existing cumulative certification gates; must preserve the Node >=24 runtime gate and report BLOCKED/NOT CERTIFIED when runtime is below 24.

Wrappers should be explicit, deterministic, and non-overlapping where practical. The current 10 duplicate test alias groups should be documented and retained until their external consumers are checked; they should not be silently removed.

## Limitations

- CI command mapping is based on explicit `run:` lines in the 11 workflow YAML files; shell scripts, composite actions, and commands invoked by a Node script are not expanded unless the package script itself explicitly calls npm run.
- Suite tags are name-based routing aids and can overlap; they are not a substitute for test-content inspection.
- A package script not directly called in CI is not necessarily unused; it may be manual, invoked by a non-CI workflow, or retained for historical compatibility.
- No package.json changes were made; no historical script was deleted or rewritten.
