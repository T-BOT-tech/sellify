# Sellify Frontend ↔ Backend Gap Analysis — Latest

Status: CANDIDATE RECONCILIATION UPDATE — NOT YET MERGED
Branch: ux/ecosystem-add-action-menu
Date: 2026-10-10
Authority: live repository source and observed CI on this branch. Main remains unchanged until this PR is reviewed and explicitly merged. Historical gap documents are reference only.

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
| Catalog | CLOSED | Canonical catalog authority is connected. |
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
| Payment frontend | PARTIAL | Dedicated app/src/payments contract/client/state/UI and canonical projection exist. The real frontend client now has a focused HTTP-route/SQLite integration regression; operational UX refinement remains. No second payment authority is needed. |
| Payment frontend certification | HARDENED ON CANDIDATE BRANCH / MAIN VERIFICATION GAP | The PF-1L real-client → actual HTTP route → Payment Core → SQLite regression passes. It verifies lost-response retry/replay, durable command persistence, unresolved provider UNKNOWN without financial mutation or duplicate ledger entries, and cross-tenant session rejection before command claim. Broader route-level positive-transition/timeout coverage remains a possible strengthening; PR #40 is still unmerged. |
| Provider execution | PARTIAL / DELIBERATE | Provider-neutral registry and existing flows exist; live provider capability must only be implemented when verified. |
| Compliance frontend | PARTIAL | Canonical backend authority and frontend authority work exist; operational workspace refinement remains. |
| Audit frontend | PARTIAL | Strong backend lineage exists; management/visibility UX remains. |
| Generic IAM membership roles | CLOSED | Canonical membership role-change boundary exists with tenant, authorization, owner and audit protections. |
| Contextual domain authorization | PARTIAL | Base IAM is closed; contextual capability/pack/domain-role composition remains a refinement. |
| Offline / outbox | CLOSED | Canonical event boundary exists. |
| Pack lifecycle | DEFERRED | Intentionally gated; do not treat as a defect. |
| Release / CI certification | HARDENED ON CANDIDATE BRANCH / MAIN VERIFICATION GAP | Candidate head b8676de7b0f6da5a24ef3de1d2a61d7a3001cd24 passed Sellify CI and Repository Security Checks (run 1385). PR #40 remains draft and unmerged, so this is not yet evidence for main. |

## 5. Primary remaining gap: End-to-end Payment Frontend certification

The backend Payment Core is not the primary missing piece, and the dedicated frontend payment modules now exist.

Existing implementation and regression evidence includes:
- app/src/payments/client.js, contract.js, state.js, ui.js, and canonical payment projection;
- authenticated tenant/session-aware API calls and required idempotency keys;
- order-to-payment linkage and coalesced ordinary payment-ensure operations;
- Payment Core regressions covering durable status-query idempotency, concurrent retries, committed-result recovery, unresolved pre-commit crashes, append-only lineage records, and audit-chain tamper detection;
- PF-1/PF-2 frontend contract, projection, runtime-client and adversarial regressions.

**Latest certification:** `phase0/gap-pf-1L-payment-frontend-http-sqlite-e2e-regression.mjs` runs the real frontend client against a spawned backend server and an isolated SQLite database. It confirms a lost response can be retried with the same key and replay the stored UNKNOWN result; the payment remains UNPAID with only its original CREATED ledger entry. It also verifies a session from tenant A cannot query tenant B's payment and cannot claim a status-query command. This test exposed a real wiring defect: the HTTP server's Payment Core store adapter omitted durable status-query and recovery lookup methods. Those methods are now wired, and the regression passes.

**Remaining certification gap:** the focused route test deliberately exercises an unresolved provider outcome; the successful MATCH → VERIFIED → ledger path is covered by Payment Core integration tests but is not yet exercised through this exact frontend-client/HTTP route harness. Add that positive route-level case only if it can be done without creating a second provider authority or duplicating existing tests. Operational UX for account selection, payment history, error recovery and audit-lineage visibility remains future refinement.

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

## 11. Recommended sequence

1. PF-1L — completed on candidate head b8676de7b0f6da5a24ef3de1d2a61d7a3001cd24: actual frontend client → HTTP route → Payment Core → SQLite; lost-response replay, unresolved outcome and tenant isolation pass.
2. PF-2 — optionally add a route-level successful MATCH → VERIFIED → ledger case and any non-duplicative timeout/error cases; existing Payment Core success-path regressions remain authoritative for now.
3. Reconcile this candidate status against main after PR review/explicit merge; do not close gaps on main based on feature-branch CI.
4. STF-1 Seller storefront/channel refinement.
5. CMP-1 Compliance/Audit operational refinement.
6. IAM-1 Contextual authorization refinement.
7. LOG-3 Rich dispatch UX refinement.
8. Final release/CI certification.
9. Re-evaluate Pack lifecycle

## 12. Non-negotiable rule

No new frontend module may create a competing domain authority. When a canonical backend authority already exists, frontend work must project and command that authority rather than reproduce it.
