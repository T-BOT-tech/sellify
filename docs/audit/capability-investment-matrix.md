# Capability investment matrix

- Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Purpose: prioritize work from verified current implementation and remaining authority gaps; not a roadmap for new verticals or microservices.

| Capability | Current state | Verified strengths | Material gap / risk | Investment decision |
|---|---|---|---|---|
| Identity, tenant and authorization | Implemented; continuously verify | Tenant-bound sessions, central `authorize()`, membership/contextual-role scope, owner/manager helper delegates to central policy. | Route-specific authorization omissions remain possible; payment routing policy is a confirmed example. | Invest in route authorization characterization and adversarial HTTP tests, not a new IAM authority. |
| Commerce / Orders | Implemented | Existing canonical order store and marketplace/seller order flows. | Cross-domain transactional coupling makes extraction risky. | Preserve authority; improve dependency tests before modularization. |
| Payment Core | Implemented; further audit required | Central PaymentCore authorization callback is injected by `backend/server.js`; financial decision, evidence, ledger, refunds and settlements use canonical core. | `GET/POST /payments/routing/policies` bypasses PaymentCore and central permission checks. | High priority: add server-side view/manage permission checks and route-level regressions. |
| Inventory | Implemented; canonical | One Inventory ledger/movement authority; vertical bridges consume it. | Shared store concentration and cross-domain transactions; no safe extraction established. | Preserve canonical ledger; map callers and atomicity before any split. |
| Procurement | Implemented / extensive | Demand, RFQ, supplier invitations, PO/receiving, and immutable RFQ-time capacity evidence snapshots. | RFQ snapshot records evidence; it is not proof of operational availability or a scheduling authorization. | Maintain snapshot immutability and evidence-quality labels; do not infer feasibility. |
| Supplier Network | Implemented / extensive | Capacity lifecycle, activation authorization, trust/qualification visibility, performance ownership and discovery visibility have targeted coverage (including merged #310–#313). | Capacity source remains supplier-declared; no trusted independent observer identity/provenance. A legacy discovery endpoint still ranks by quantity without temporal/unit checks. | Preserve Supplier Network as evidence source; do not add a second capacity authority. |
| Discovery Fabric | Implemented / bounded | Unified provider flow normalizes candidates, applies deterministic hard constraints, ranks explainably, and remains read-only. | Strict temporal checks apply in unified Discovery; direct legacy Supplier Network discovery route bypasses them. | Keep strict matcher canonical; treat legacy route as advisory only until reconciled. |
| Fulfillment and Logistics | Implemented / partial | Assignment, lifecycle, proof/exception and existing Inventory consequence are established. GAP-2 boundary remains frozen. | Scheduling has no trusted operational capacity/feasibility authority. | Keep frozen Logistics boundary; scheduling stays request-only. |
| Logistics Scheduling | Request-only | Tenant/location authorization, idempotent commands, local overlap detection and fail-closed unknown evaluation. | No server-authenticated external capacity decision is wired; caller-supplied `FEASIBLE` is ignored. | Do not invest in execution/dispatch yet; first establish trusted operational capacity/feasibility authority. |
| Service resources and bookings | Implemented / extensive | Resource, availability, commitment and booking flows have targeted persistence and scope tests. | Shared location/resource authorization and transaction coupling. | Improve integration tests; defer extraction. |
| Restaurant | Implemented / bounded | Recipe persistence has dedicated tenant/server authority tests. | Recipe functions share store/audit/serialization infrastructure. | Candidate for a later small extraction proof, not approved now. |
| Business templates and Packs | Implemented / bounded | Tenant business-template config and Pack lifecycle have explicit server persistence/authorization. | Shared tenant/owner/readiness/audit dependencies. | Keep configuration as infrastructure/experience composition, not a new domain authority. |
| Test and release workflow | Extensive but fragmented | 482 scripts, 11 workflows, 203 direct workflow test invocations, 185 source-hash/source-manifest files. | No generic `test`, integration, security, e2e or release wrappers; exact command duplicates exist. | Add wrappers only after mapping; preserve every historical script and hash control. |
| Backend maintainability | Partial | All 247 route-table handlers resolve; SQL/table/index/migration inventories now exist. | 274,791-character server and 971,694-character store remain concentrated; static map is not a runtime call graph. | Continue evidence mapping; no broad refactor. |

## Capacity evidence detail

- Supplier Network writes `source='DECLARED'` and stamps `observed_at` server-side; supplier-provided `validUntil` is validated. `created_by_user_id` / `updated_by_user_id` identify the supplier-side actor, not an independent observer.
- Unified Discovery's temporal matcher requires active status, `SELF_REPORTED` quality, valid `observedAt`, `validUntil`, `evaluatedAt`, requested period overlap, quantity and unit. It rejects `OBSERVED`/`VERIFIED` without trusted observer binding.
- The Procurement UI calls `/api/discovery`, which uses the unified matcher. The direct `/tenants/:chatId/supplier-network/discovery` route calls the legacy store discovery function directly and does not apply the strict temporal matcher.
- Procurement RFQ-time snapshots retain current and legacy-unknown evidence with quality/freshness labels; they are immutable historical evidence, not operational feasibility decisions.

## Investment order

1. Close the payment routing policy permission gap and add route-level authorization tests.
2. Complete route-level test assertion mapping for all high-risk write routes.
3. Preserve and validate SQLite transactional clusters; do not extract the monolith yet.
4. Label and constrain the legacy quantity-only Supplier Network discovery path; do not use it for hard time-sensitive decisions.
5. Define trusted independent observer identity/provenance and a server-owned operational capacity/feasibility authority before any Logistics Scheduling execution.
6. Add additive test wrappers after test-command review; retain source-hash and historical scripts.