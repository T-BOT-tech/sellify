# Sellify Frontend ↔ Backend Gap Analysis — Latest

Status: CANDIDATE RECONCILIATION UPDATE — NOT YET MERGED
Branch: ux/ecosystem-add-action-menu
Date: 2026-10-11
Authority: live repository source and observed CI on this branch. Main remains unchanged until this PR is reviewed and explicitly merged. Historical gap documents are reference only.

Latest verified candidate before this documentation reconciliation: `f4fc0491adb3f8993cf47d4361243eb72589ffee`. It passed Sellify CI run `38153693840` and Repository Security Checks run `38153693830` on 2026-10-11. This document-only update will create a new branch head; its own CI status must be checked separately. The candidate includes order-sync idempotency normalization, a runtime SQLite migration-recovery scenario with migration 53 already recorded and migration 54 missing (including verification that the unique index is installed), and a Payment Core state-machine correction allowing determinate REJECTED/DUPLICATE/MISMATCH/PARTIAL outcomes from UNPAID. The PF-1L real HTTP/SQLite regression now specifically verifies MISMATCH commit and recovery after query-result persistence failure without repeating provider or ledger work. PR #40 remains open, draft, and unmerged; candidate-branch evidence is not main-branch certification.

## 1. Purpose

This document supersedes the older frontend/backend gap matrix as the current reconciliation view.

The central question is no longer whether a domain has backend code or a frontend screen. The relevant question is whether the complete chain is canonical, authorized, scoped, idempotent, concurrency-safe, auditable, regression-tested, and operationally connected.

## 2. Current architecture baseline

Canonical pattern:

Frontend Intent / UI
→ Canonical Application Contract
→ Backend Authority
→ Authorization / Tenant Scope
→ State Transition
→ Audit / Event / Outbox

Financial pattern:

Payment UI
→ Canonical Payment API
→ Payment Core authorization
→ Evidence / Provider Adapter
→ Verification
→ Invariant Gate
→ Payment Decision
→ Append-only Ledger
→ Audit / Event / Outbox

Delivery pattern:

Order / Marketplace Order
→ Seller Order
→ Fulfillment
→ Delivery Assignment
→ Delivery Lifecycle
→ Proof / Exception
→ Existing Inventory consequence

Payment and Settlement remain independent authorities.

## 3. Status taxonomy

- CLOSED — required authority and integration are implemented.
- HARDENED — implementation exists and has explicit security/concurrency/regression hardening.
- PARTIAL — meaningful implementation exists but an operational/product contract remains.
- OPEN — required implementation is materially missing.
- DEFERRED — intentionally gated and not a defect.
- VERIFICATION GAP — source implementation exists, but runtime/CI evidence is not yet available.

A domain may be CLOSED in source while still carrying a VERIFICATION GAP.

## 4. Reconciled domain matrix

| Domain | Current status | Current finding |
|---|---|---|
| Auth / tenant sessions | CLOSED | Canonical tenant/session boundary exists. |
| Customers | CLOSED | Canonical customer APIs are connected. |
| Catalog | CLOSED | Canonical product catalog authority is connected and reused by the Add menu. |
| First-class service catalog type | DEFERRED | The existing catalog form and persisted contract are product-shaped. A service needs explicit canonical type semantics and compatible inventory/fulfillment behavior; do not advertise service creation as supported until those boundaries are implemented and tested. |
| Orders | CLOSED | Canonical order/sync path is connected. |
| Inventory | HARDENED | Canonical inventory authority exists; legacy projections must not become competing authority. |
| Locations | CLOSED | Canonical location CRUD exists. |
| B2B pricing | CLOSED | Canonical pricing authority exists. |
| B2B accounts / AR | CLOSED | Canonical backend authority exists. |
| B2B credit terms | CLOSED | Canonical backend authority exists. |
| B2B purchase orders | CLOSED | Canonical backend authority exists. |
| B2B invoices | CLOSED | Canonical backend authority exists. |
| B2B quotes | PARTIAL | Canonical quote API/module exists; final UX/certification remains a refinement. |
| Procurement | CLOSED | Canonical backend integration exists. |
| Supplier Network | CLOSED | Canonical backend integration exists. |
| Marketplace | HARDENED | Marketplace integrity architecture is established; checkout must not be rebuilt. |
| Telegram buyer storefront | CLOSED | Connected to canonical storefront/order contracts. |
| Seller storefront channels | PARTIAL | Canonical authority and consistency work exist; management UX can be refined. |
| Telegram seller configuration | PARTIAL | Backend authority exists; operational configuration UX remains a refinement. |
| Logistics / fulfillment | HARDENED | GAP-2.1–2.13 completed; delivery authority is now canonical. |
| Delivery staff | HARDENED | Courier role, ownership, tenant/location scope and lifecycle enforcement are server-side. |
| Rich dispatch UX | PARTIAL | Workload/balancing/projection contracts exist; richer operational UX is future refinement. |
| Payment Core | HARDENED | Payment authority, evidence, verification, decisions, ledger, authorization and reconciliation boundaries exist. Durable status-query idempotency/recovery, append-only evidence/verification/decision records, and runtime audit-chain tamper detection are covered by regressions. |
| Payment schema migration recovery | HARDENED | Migration 54 (provider-verification uniqueness index) is evaluated independently of migration 53. The regression now exercises the real SQLite migration runner from a seeded state where migration 53 is recorded but migration 54 is absent, then verifies migration 54 is recorded and the unique index exists. |
| Payment frontend | PARTIAL | Dedicated app/src/payments contract/client/state/UI and canonical projection exist. The real frontend client now has a focused HTTP-route/SQLite integration regression; operational UX refinement remains. No second payment authority is needed. |
| Payment frontend certification | HARDENED ON CANDIDATE BRANCH / MAIN VERIFICATION GAP | PF-1L exercises the real frontend client → HTTP route → provider adapter → Payment Core → SQLite path for unresolved and successful provider observations. It verifies lost-response replay, UNKNOWN without financial mutation, successful MATCH → VERIFIED with one canonical ledger transition, no duplicate evidence/verification/decision/ledger on replay, same-key retry after a retryable provider network failure, a determinate MISMATCH transition from UNPAID and recovery after query-result persistence failure, and cross-tenant rejection before command claim. Previously verified code candidate `f4fc0491adb3f8993cf47d4361243eb72589ffee` passed Sellify CI and Repository Security Checks (runs 38153693840 and 38153693830); PR #40 remains open, draft, and unmerged, so main is still a verification gap. |
| Provider execution | PARTIAL / DELIBERATE | Provider-neutral registry and existing flows exist; live provider capability must only be implemented when verified. |
| Compliance frontend | PARTIAL | Canonical backend authority and frontend authority work exist; operational workspace refinement remains. |
| Audit frontend | PARTIAL | Strong backend lineage exists; management/visibility UX remains. |
| Generic IAM membership roles | CLOSED | Canonical membership role-change boundary exists with tenant, authorization, owner and audit protections. |
| Contextual domain authorization | PARTIAL | Base IAM is closed; contextual capability/pack/domain-role composition remains a refinement. |
| Offline / outbox | CLOSED | Canonical event boundary exists. |
| Pack lifecycle | DEFERRED | Intentionally gated; do not treat as a defect. |
| Release / CI certification | HARDENED ON CANDIDATE BRANCH / MAIN VERIFICATION GAP | Previously verified code candidate `f4fc0491adb3f8993cf47d4361243eb72589ffee` passed Sellify CI and Repository Security Checks (runs 38153693840 and 38153693830). PR #40 remains draft and unmerged, so this is not yet evidence for main. |

## 5. Payment frontend certification — candidate branch hardened

The backend Payment Core is not the primary missing piece, and the dedicated frontend payment modules now exist.

Existing implementation and regression evidence includes:
- app/src/payments/client.js, contract.js, state.js, ui.js, and canonical payment projection;
- authenticated tenant/session-aware API calls and required idempotency keys;
- order-to-payment linkage and coalesced ordinary payment-ensure operations;
- Payment Core regressions covering durable status-query idempotency, concurrent retries, committed-result recovery, unresolved pre-commit crashes, append-only lineage records, and audit-chain tamper detection;
- PF-1/PF-2 frontend contract, projection, runtime-client and adversarial regressions.

**Latest certification:** `phase0/gap-pf-1L-payment-frontend-http-sqlite-e2e-regression.mjs` runs the real frontend client against a spawned backend server and isolated SQLite database. It covers unavailable and successful provider observations through the real adapter. The successful case validates observed amount, currency, receiver account, reference, transaction ID, and observation time before Payment Core commits `MATCH → VERIFIED`. A lost response followed by a same-key retry replays the committed result without another provider call or duplicate evidence, verification, decision, or ledger entries. An unavailable outcome remains `UNKNOWN` and leaves payment `UNPAID`; cross-tenant requests are rejected before command claim. The test also simulates provider network failure followed by recovery: the retryable failure is persisted, a same-key retry atomically reclaims only this known-safe pre-evidence failure, and the later successful result is committed once. A determinate provider failure now transitions an initially UNPAID payment to MISMATCH; the regression forces SQLite to reject the status-query result write after the canonical transition, then verifies same-key recovery reconstructs the persisted mismatch lineage without another provider call or duplicate ledger/evidence/verification/decision rows. This exposed and fixed missing durable HTTP store wiring, provider-adapter observation-field/status-shape mismatch, and decision logic that could turn UNKNOWN plus missing fields into a financial mismatch. Previously verified code candidate `f4fc0491adb3f8993cf47d4361243eb72589ffee` passed Sellify CI and Repository Security Checks (runs 38153693840 and 38153693830).

**Remaining certification gap:** the critical success, unresolved-outcome, lost-response replay, same-key recovery after a retryable network failure, no-duplicate-effects, and tenant-isolation paths now pass through the real frontend-client/HTTP route harness. A dedicated timeout-specific variant may be added only if it adds evidence beyond the network-failure case and existing provider transport tests. An ambiguous pre-commit crash intentionally remains unresolved unless canonical records establish a trustworthy outcome; recovery must not blindly repeat provider or financial work. Operational UX for account selection, payment history, unresolved-command recovery, and audit-lineage visibility remains future refinement. The PF-1L non-success recovery case specifically covers MISMATCH; the other supported non-success recovery targets do not each yet have a separate lost-result HTTP/SQLite scenario.

Frontend must never:
- maintain a financial ledger;
- mark financial success independently;
- settle/refund directly through a provider;
- expose provider credentials;
- use client permissions as a security boundary.

## 6. Logistics reconciliation

Historical GAP-2 described missing logistics authorization and delivery staff enforcement. That description is obsolete.

GAP-2.1 through GAP-2.13 now establish:
- canonical assignment authority;
- mandatory idempotency;
- courier role/ownership/location scope;
- serialized lifecycle transitions;
- exception recovery;
- workload projection;
- deterministic balancing;
- proof immutability;
- route/dispatch read-only projection;
- payment/settlement authority separation;
- adversarial and production-readiness gates.

Future logistics work should therefore be product refinement, not another authority rewrite.

## 7. Storefront and compliance reconciliation

Seller storefront/channel and compliance/audit areas have substantial implementation and regression coverage. They should be treated as refinement/certification work unless source inspection identifies a concrete missing contract.

Do not reopen these areas as greenfield architecture.

## 8. IAM reconciliation

Generic membership role management is implemented.

Do not collapse contextual domain roles into the base role catalogue.

Preferred future model:

Identity
→ Membership
→ Base Role
→ Contextual Capability / Pack
→ Scoped Domain Role
→ Permission
→ Resource Scope
→ Server Enforcement
→ Audit

## 9. Pack lifecycle

Pack lifecycle remains intentionally gated. Activation/installation should only be opened when its preconditions and operational contract are explicitly certified.

## 10. Verification distinction

Source-level implementation does not equal runtime certification.

For every gap:
1. inspect the current branch and compare it with main;
2. implement minimally;
3. add focused regression;
4. wire CI;
5. observe CI execution where available;
6. record any unavailable workflow evidence explicitly.

The candidate branch's current CI result must not be represented as a main-branch result while PR #40 remains unmerged.

## 10A. Deployment and rollback safety review

The current SQLite migration chain contains these relevant boundaries:

- Migration 54 independently installs the unique verification identity index even when migration 53 is already recorded. The runtime regression proves this recovery shape on an isolated database, but it does not prove production data is free of duplicates. Before rollout, check for duplicate `(evidence_id, verifier, verifier_version)` tuples; the unique-index migration will fail if conflicting historical rows exist.
- Migration 64 adds the durable `payment_status_query_commands` table. Migrations 65 and 66 add triggers that reject updates and deletes to canonical payment evidence, verification, and decision records. They are additive schema changes, but 65/66 intentionally change runtime behavior: an older application path that attempts to mutate/delete those rows, including via parent-row cascades, can fail after the triggers are installed. Treat this as a forward-only application compatibility boundary, not a normal binary-only rollback.
- Do not remove the append-only triggers as a rollback shortcut. If an operational retention/purge requirement emerges, define an explicitly authorized, audited retention/archive workflow with tested lineage preservation before implementation.
- The rolling backup uses SQLite `VACUUM INTO`. Review found that its filename discarded milliseconds, so two backup calls in the same second could target the same destination. Commit f4fc0491adb3f8993cf47d4361243eb72589ffee adds a random suffix and a runtime regression that creates two immediate snapshots and checks both are distinct and non-empty. Sellify CI run `38153693840` and Repository Security Checks run `38153693830` passed for that code candidate.
- Remaining operational evidence gap: no production-like restore rehearsal is established by the focused regressions reviewed here. Before a production rollout, take a pre-deploy backup, verify the copied database with SQLite integrity checks, rehearse migrations against a recent production-like copy, and confirm restore plus critical payment/order/inventory reads. Keep an independently stored protected backup; the seven-file local rotation is not itself a disaster-recovery strategy.

These are rollout/rollback safeguards, not a claim that a production migration or restore has already been executed.

## 10B. Payment lineage append-only regression coverage

Added `phase0/payment-lineage-append-only-regression.mjs` and wired it into the Node 24 baseline CI. The runtime SQLite test seeds canonical payment/evidence/verification/decision rows, then proves updates and direct deletes are rejected for all three lineage tables. It also attempts to delete the parent payment and confirms the decision-history cascade is blocked and all seeded records remain present.

This regression validates the migration-65/66 trigger behavior on a fresh isolated database. It does not replace a production-like migration/restore rehearsal, nor does it define an approved data-retention process.

## 10C. GAP-1.24 — fenced status-query claims (candidate; runtime verification pending)

The candidate branch now adds migration 67 for durable status-query claim ownership: monotonically increasing claim generation, unique claim token, execution phase, and an unstarted-claim lease. Migration handling checks each column independently so an interrupted additive DDL sequence can resume. Existing legacy `IN_PROGRESS` commands are conservatively classified as `PROVIDER_IN_FLIGHT`; they are not automatically reclaimed because their provider-execution phase cannot be proven.

The SQLite store permits takeover only when a command remains `IN_PROGRESS` in phase `CLAIMED` and its lease has expired. Provider work must first atomically change the phase to `PROVIDER_IN_FLIGHT` under the current token/generation. The canonical `commitPaymentDecision` transaction checks the same claim ownership before financial mutation, and normal command completion is claim-token-aware. The provider adapter query payload excludes the internal fencing token.

The PF-1L regression now includes direct SQLite coverage for expired unstarted-claim takeover, generation/token rotation, rejection of the superseded owner before provider work, rejection at the canonical financial commit boundary, rejection of stale completion, and non-reclaim of provider-in-flight commands.

**Evidence status for this candidate:**
- Source-level syntax parsing: passed for `backend/lib/store-sqlite.js`, `backend/lib/payments/payment-core.js`, and the updated PF-1L regression.
- Focused runtime regression: **not yet executed**.
- Candidate CI evidence: after the migration-count assertions were corrected, the baseline regression and GAP-1.11 payment provider status lifecycle regression passed on commit `1f5b92da1c69f0f172b77dd868c7f0f988bfb17c`. The same CI run then failed in `phase0/gap-1.19-payment-adversarial-certification-regression.mjs`, whose Payment Core store wrapper also omitted `markPaymentStatusQueryProviderStarted`; this produced the intended fail-closed error `PAYMENT_STATUS_QUERY_CLAIM_UNAVAILABLE`. The GAP-1.19 test wrapper now wires the actual SQLite store function in commit `1240c771523da98b17d7cc425ae055b019c7f519`. Repository Security Checks passed for the preceding candidate. CI and security results for the correction commit are pending; do not infer PF-1 completion from the skipped end-to-end step after the earlier failure.
- A concurrent-recovery race regression has been added but is **not yet executed**. Full HTTP crash-boundary coverage for the new claim phases, mixed-version worker compatibility, and production-like migration/restore rehearsal remain **not yet evidenced**.

GAP-1.24 therefore remains **IMPLEMENTED ON CANDIDATE / NOT YET RUNTIME-VERIFIED / NOT CERTIFIED**. Do not treat the new fencing behavior as production-ready until the focused tests and CI/security checks have actually run on this candidate. The conservative unresolved behavior for a command whose provider call may have started remains intentional.
## 11. Recommended sequence

1. PF-1L — completed and CI-certified on candidate branch; success, unresolved outcome, lost-response replay, safe same-key retry after transient provider network failure, no-duplicate effects, and tenant isolation pass.
2. First-experience catalog contract — the Add menu now says “Add product” because the current catalog form is product-shaped. Define first-class service semantics only after checking order, inventory, and fulfillment boundaries; do not create a competing catalog authority.
3. PF-2 — add a timeout-specific route case only if it proves a distinct invariant beyond the existing transport and network-retry regressions.
4. Reconcile candidate status against main after PR review and explicit merge; do not close gaps on main based on feature-branch CI.
5. STF-1 Seller storefront/channel refinement.
6. CMP-1 Compliance/Audit operational refinement.
7. IAM-1 Contextual authorization refinement.
8. LOG-3 Rich dispatch UX refinement.
9. Final release/CI certification.
10. Re-evaluate Pack lifecycle

## 12. Non-negotiable rule

No new frontend module may create a competing domain authority. When a canonical backend authority already exists, frontend work must project and command that authority rather than reproduce it.
