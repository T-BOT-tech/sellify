# Sellify architecture and dependency map

- Audited source baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918` on `main`
- Audit branch: `audit/route-sqlite-boundary-map-2026-11-23`
- Scope: source-level dependency characterization; no production refactor or runtime behavior change.

## System shape

Sellify is an offline-first, multi-tenant commerce and operations platform. The repository is a modular monolith with a browser ES-module PWA, a Node.js HTTP server, domain/capability libraries, and one shared SQLite persistence module. Capabilities are logical boundaries; they are not automatic microservices.

| Layer | Current location | Responsibility / boundary |
|---|---|---|
| Experience and channels | `app/`, Telegram storefront, browser modules | Role-aware workflows and channel-specific presentation; UI visibility is not authorization. |
| HTTP and integration boundary | `backend/server.js` | 247 explicit route entries, shared dispatch, auth/session checks, orchestration, 6 inline branches. |
| Domain/capability services | `backend/lib/` | Payment Core, Discovery, event replay, fulfillment/logistics, authorization, adapters, Supplier Network, etc. |
| Persistence | `backend/lib/store-sqlite.js` | 253 exported functions, SQLite schema/migrations, domain persistence and several cross-domain transactions. |
| Tests and certification | `phase0/`, `package.json`, `.github/workflows/` | 482 package scripts, targeted regression gates, release/source-hash controls. |

## Backend concentration measurements

| Measure | Current main evidence |
|---|---:|
| `backend/server.js` | 274,791 characters in fetched source |
| Explicit route table entries | 247 |
| Additional inline dispatch branches | 6 |
| Total detected route entries | 253 |
| Distinct named route handlers | 137 |
| Duplicate method/pattern keys | 0 |
| `backend/lib/store-sqlite.js` | 971,694 characters in fetched source |
| Exported store functions | 253 |
| Literal SQL API calls inside exported functions | 947 |
| Full-file individual SQL statements | 1,639 |
| Unique SQL tables | 110 |
| Foreign-key declarations / unique edges | 286 / 280 |
| Index declarations / unique names | 206 / 192 |
| Migration guards | 85 |

Detailed route evidence is in `route-characterization.md` and `route-characterization.json`. Detailed persistence evidence is in `sqlite-dependency-map.md` and `sqlite-dependency-map.json`.

## Dependency flow

```text
Browser / AI / channel experience
          │
          ▼
HTTP route + session + central authorization + request validation
          │
          ▼
Capability / domain service (Payment Core, Discovery, Procurement, etc.)
          │
          ▼
Canonical domain authority and scoped store operation
          │
          ▼
SQLite transaction + audit/event/idempotency consequences
```

External systems follow the provider-neutral boundary: canonical contract → adapter → provider. Discovery is read-only and does not own supplier, inventory, order, procurement, payment, or trust truth.

## Canonical ownership and cross-domain dependencies

| Capability / domain | Canonical authority | Important consumers / constraints |
|---|---|---|
| Identity and access | Existing Identity, membership, session, contextual-role and central `authorize()` contracts | Route/UI role visibility cannot replace server authorization. |
| Commerce Orders | Existing order store and order lifecycle | Marketplace, Fulfillment, Service, Payment and seller order feed consume it. |
| Inventory | Existing canonical Inventory ledger and movement functions | Procurement receiving, Marketplace, Restaurant and Fulfillment must use the same stock authority. |
| Payment | Payment Core and provider adapters | Decisions, ledger, evidence, refund, settlement, idempotency and routing must preserve their transaction and authorization boundaries. |
| Procurement | Procurement demand/RFQ/PO/receipt authority | Supplier Network evidence is source input; RFQ snapshot is Procurement-owned history; receipt posting coordinates Inventory. |
| Supplier Network | Supplier Network participation, capacity, qualification, trust and performance records | Discovery reads these records; Procurement snapshots them; it does not create operational capacity authority. |
| Discovery | Read-only federated matching and ranking | Uses providers and strict matching; does not select, authorize, reserve or execute. |
| Fulfillment and Logistics | Existing Fulfillment and delivery assignment/lifecycle authority | Frozen Order → Fulfillment → Delivery Assignment → Delivery Lifecycle → Proof/Exception → Inventory consequence. |
| Logistics Scheduling | Existing request/coordination queue | Remains request-only until trusted capacity/feasibility authority exists. |
| Service | Existing service resource, availability, booking and commitment authority | Resource/location scope and idempotent command boundaries are coupled. |

## Verified high-coupling transaction clusters

- Marketplace checkout/cancellation coordinates Marketplace order and seller-order state, reservations, Inventory movements, Payment allocation/refund and settlement records, and idempotency.
- Payment decision/refund/settlement operations coordinate financial state, evidence, ledger, idempotency and Marketplace consequences.
- Procurement receipt posting coordinates receipt intent/lines, canonical Inventory movement and audit.
- Fulfillment/delivery transitions coordinate command replay, tenant/location/courier scope, proof/lifecycle and Inventory consequences.
- Service resource/availability/booking/commitment functions share resource and location scope.
- Identity/session/membership/contextual-role lifecycle functions share tenant identity and authorization invariants.

These are transaction and invariant boundaries. They are not recommendations to split each group into a service.

## Confirmed route security finding

`POST /tenants/:chatId/payments/routing/policies` requires a tenant session but does not call `requireAuthorization`, Payment Core, or another role check. `upsertPaymentRoutingPolicy` validates the tenant and payload but does not authorize its actor. Any authenticated tenant member can change provider routing policy. The corresponding GET also lacks the `payments:view` check used by the explicit Payment routing operation. See `route-characterization.md` for evidence and test gap.

## Safe modularization posture

- Do not extract route modules based on URL prefix or function name.
- Do not split `store-sqlite.js` based on table-name prefixes.
- No extraction is approved in this audit pass.
- Potential future proof slices are small and isolated (e.g. Restaurant Recipes, tenant business-template configuration, Pack lifecycle), but each still has shared audit, tenant authorization, or transaction dependencies.
- Preserve CI/source-hash certification and all historical scripts; no broad rewrite or manifest regeneration.

## Known limitations

- SQL and call graph data are static extraction. Dynamic SQL, imported/indirect calls, and callback dispatch need targeted review.
- Route tests are not all linked to exact route assertions yet.
- Logical table ownership is provisional and must be validated against domain contracts and transactional callers.
- No production runtime test or full release certification was executed by this documentation-only audit pass.