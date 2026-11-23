# Remediation roadmap — current-main audit findings

Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`.

This roadmap is deliberately limited to evidence found in the route, SQLite, test and capacity-boundary audits. It is not a new architecture or parallel implementation plan.

## P0 — restore persistence and audit integrity

| Item | Verified finding | Required outcome | Safe acceptance evidence |
|---|---|---|---|
| R0.1 Payment audit provenance | Refund/settlement audit calls in `store-sqlite.js` pass payment ID as entity type and actor ID as entity ID; actor context is omitted. | Correct canonical child entity type/ID and actor/organization/device/location/lineage context. | Regression asserts audit `entity_type`, `entity_id`, `actor_id`, organization, device, reason and lineage for standalone and Marketplace-cancellation refund paths. |
| R0.2 Payment request/audit atomicity | Refund and settlement rows are inserted before audit without a shared transaction. | Audit failure rolls back the financial request or preserves an explicitly documented pending state with durable audit intent. | Fault-injection rollback tests; preserve caller-owned transaction behavior and idempotent replay. |
| R0.3 Procurement receipt/Inventory atomicity | Receipt PENDING row/lines commit before sequential Inventory movements. A later-line failure can leave partial stock movements and a PENDING receipt. | All receipt lines and canonical Inventory movement consequences commit atomically or remain safely retryable without partial posting. | Fail-after-first-line rollback, concurrent same-key replay, deterministic event identity, final POSTED idempotency, and Inventory ledger assertions. |

Related open PRs #306 and #298 contain proposed work but are stale relative to current main and are not merged. Do not merge them as-is. Replay/reconcile their intent on a branch from current main and preserve intervening changes.

### P0 route authorization gaps

| Item | Verified finding | Required outcome | Safe acceptance evidence |
|---|---|---|---|
| R0.4 Payment routing-policy authorization | `GET` and `POST /tenants/:chatId/payments/routing/policies` require only a tenant session, then call the SQLite list/upsert functions directly. Those functions enforce tenant/organization lookup but not `payments:view` or `payments:route`; `PaymentCore.resolveRouting` checks `payments:route` but is bypassed by this HTTP handler. | Enforce read/manage permission at the server boundary and preserve tenant/location scope. | HTTP regression: unauthorized staff/buyer denied; cashier read allowed only under `payments:view`; manager/owner policy mutation allowed under `payments:route`; cross-tenant/location access denied. |
| R0.5 Sync write authorization | `POST /sync/:chatId` requires a tenant session and calls `saveQueuedOrders`; that store function accepts no actor and performs no role-permission check. The role policy grants `orders:create` to owner/manager/cashier roles but not generic staff; `sync:manual` is manager-scoped. | Make the intended sync-write role contract explicit and enforce it server-side before persisting orders/ensuring Payment state. | HTTP regression: staff without `orders:create` denied; permitted roles succeed; idempotent replay and offline queue semantics remain unchanged. |

## P1 — close route, authorization and capacity evidence gaps

| Item | Verified finding | Required outcome | Safe acceptance evidence |
|---|---|---|---|
| R1.8 Legacy Supplier Network discovery semantics | `GET/POST /tenants/:chatId/supplier-network/discovery` calls `discoverSupplierNetwork` directly, bypassing `discoverUnified`. The `minimumQuantity` filter compares raw numbers, excludes suppliers without a matching signal, and ignores unit, availability, period, validity, observation time and quality. The store only prefilters ACTIVE and buyer-visible signals; `UNAVAILABLE`/`ON_REQUEST` can still pass. | Define this route as an explicitly non-authoritative discovery hint or route it through the bounded Discovery matcher; apply consistent subject, unit, availability and temporal evidence semantics without creating a new capacity authority. | HTTP regression covers wrong unit, UNAVAILABLE/ON_REQUEST, expired validity, non-overlapping period, missing subject binding and no operational mutation. Preserve supplier visibility and authorization. |

1. Complete manual method-by-method review of the 247 explicit routes, especially handlers reused across GET/POST/PATCH/DELETE. The route map records 166 method-conditional entries; do not treat a handler-wide permission list as applying to every method.
2. Verify the seven public/token-scoped surfaces individually and retain only the documented public data or explicit bearer/challenge boundary.
3. Inspect the 43 route entries without filename-based test candidates. Candidate filename matches elsewhere are not test coverage proof.
4. Preserve server-side permission and tenant/location/resource scope enforcement. UI role visibility remains presentation only.
5. Keep Supplier Network capacity declarations at SELF_REPORTED/UNKNOWN. Do not accept OBSERVED/VERIFIED for hard decisions until a trusted observer identity, durable provenance and server-side verification exist.
6. Keep Logistics Scheduling request-only. UNKNOWN must block SCHEDULED; Discovery matching is not operational feasibility or authorization.
7. Integrate the SC-02 temporal eligibility gate and Phase 21.20 RFQ snapshot regression into a durable mainline CI path if they are required acceptance evidence. Their current focused workflow is PR/path-filtered and not a general main-push workflow. Review L11.8 decision regression wiring as well.

## P2 — test command consolidation, without deleting scripts

1. Retain all 482 root scripts and the 11 duplicate command groups. Multiple aliases can be historical phase interfaces.
2. Add wrappers only after identifying which aliases are canonical and confirming source-hash impact.
3. Proposed wrappers: `test`, `test:integration`, `test:security`, `test:e2e`, `test:release`. Keep them additive and invoke each underlying suite once.
4. Keep release certification separate from fast tests; keep source-hash checks and Node 24 runtime checks in the release path.
5. Do not modify historical source-hash manifests to accommodate new aliases. Reconcile active manifests first.
6. Harden the Perplexity inventory gates: preserve raw route entries until duplicate checks run, and assert repeated table declarations from declaration lines rather than from an already-deduplicated table map. Keep path/name-based classifications as review hints only.

## P3 — modularization after invariants are fixed

1. Do not extract route modules yet. Use the route characterization map to finish method-specific authorization, validation, test and store-boundary review.
2. Do not extract from `store-sqlite.js` yet. First fix Payment audit and Procurement receipt atomicity, then verify cross-domain invariants and call graph.
3. Review the 74 read/projection candidates as a possible first extraction slice. Confirm helper dependencies, authorization, indirect callers, migration coupling and API compatibility before selecting any.
4. Keep together the Payment/Marketplace settlement and refund cluster, Procurement/Inventory receipt cluster, Marketplace checkout/order consequences, Fulfillment/Logistics assignment lifecycle, Service commitments/bookings, Supplier Network derived evidence and Identity membership/session/device boundary.
5. Preserve a single deployable service and shared persistence connection unless independent runtime, ownership and failure boundaries are proven. Do not create microservices based on Pack or vertical names.

## Explicitly deferred

- No new Supplier Network authority.
- No new Logistics/Inventory capacity authority.
- No route or SQLite module extraction in this audit.
- No new vertical expansion, AI autonomous execution, or channel-specific domain truth.
- No package.json/CI changes until test and source-hash mapping is accepted.
