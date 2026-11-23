# Sellify architecture and dependency map

Baseline: `main` at `e216db18ade2a5ffa66aff9dc3096e207251a918`.

## 1. System shape

Sellify is currently a single deployable Node backend with a browser/PWA application and a shared declarative Pack manifest. The backend entry point is `backend/server.js` (4,170 lines; 274,791 bytes). Runtime SQLite persistence and most backend domain-store operations are concentrated in `backend/lib/store-sqlite.js` (14,867 lines; 971,694 bytes).

This is a modular-monolith direction, not a set of independent microservices. Several logical capability modules already exist, but their persistence and transaction boundaries still converge on the shared SQLite store.

## 2. Runtime request and mutation flow

```text
PWA / Telegram / Web / other channel
        |
        v
app/src UI + channel adapters + experience contracts
        |
        v
backend/server.js
  - HTTP/CORS/rate limiting
  - 247 explicit route-table entries
  - 5 intentional inline/static handlers plus the separate `/health` infrastructure endpoint
  - 137 distinct named route handlers
        |
        +--> authentication/session resolution
        +--> backend/lib/authorization.js
        +--> backend/lib/tenant-isolation.js
        |
        v
existing capability/service boundary
  - PaymentCore / provider adapters
  - Discovery Fabric / provider registry
  - Logistics provider execution composition
  - event replay / failure isolation
  - Pack lifecycle readiness
        |
        v
backend/lib/store-sqlite.js
  - 253 exported functions
  - 110 unique tables / 112 table declarations
  - migrations, queries, transactions, audit and persistence
        |
        v
canonical domain state + events/audit
```

This is a dependency map, not a proposed new gateway. The route layer authenticates and authorizes each request; the dispatcher does not provide a universal session check. See [route characterization](./route-characterization.md).

## 3. Existing logical capability boundaries

| Boundary | Existing implementation | Architectural role |
|---|---|---|
| Identity, sessions and authorization | `backend/server.js`, `backend/lib/authorization.js`, `backend/lib/tenant-isolation.js`, `backend/lib/security-context.js`, store session/membership functions | Authentication/session resolution and server-side permission/scope enforcement |
| Payment | `backend/lib/payments/payment-core.js`, decision engine, invariant gate, evidence authority, provider registry/adapters and verification modules | Payment lifecycle, evidence, decisions, routing and provider integration; persistence is delegated to store |
| Discovery | `backend/lib/discovery/index.js`, provider registry, unified discovery, matching contract, explainable ranking, opportunity model and providers | Read-only federated matching/ranking; does not own product, supplier, inventory, order, procurement, payment or trust truth |
| Logistics provider execution | `backend/lib/logistics/provider-execution-service.js`, application, runtime, deployment adapter and callback application | Adapter/delegate composition; canonical mutations are delegated to existing domain transactions |
| Event reliability | `backend/lib/event-replay.js`, `backend/lib/event-failure-isolation.js` | Pure replay/failure policy helpers; `sync_events` remains the persistence authority |
| Pack lifecycle | `backend/lib/pack-lifecycle-readiness.js`, `shared/vertical-pack-manifests.js`, existing server/store lifecycle | Readiness projection and lifecycle preconditions; no second entitlement or lifecycle store |
| Platform contracts | `app/src/platform/authority-registry.js`, `capability-contract.js`, adapter/integration framework | Declarative capability-to-authority mapping; explicitly does not persist, authorize or execute |
| Experience and workspace | `app/src/experience/*`, `app/src/authorization/*`, `app/src/ui/*` | Presentation, state and user journey; UI visibility is not authorization |
| Channels | `app/src/platform/telegram.js`, `web.js`, `whatsapp.js`, `sms.js`, `app/src/channels/*`, Telegram storefront modules | Channel-specific interaction over shared capability contracts |
| Vertical/business templates | `app/src/verticals/*`, `app/src/restaurant/*`, `app/src/warehouse/*`, `app/src/procurement/*`, `app/src/supplier-network/*`, `shared/vertical-pack-manifests.js` | Composition of capabilities and configuration; must not recreate Core entities or authorities |

The authority registry declares Procurement, Supplier Network, Commerce, Inventory, Payments, Customers, Locations, Fulfillment, Logistics, Documents, Audit, Country, Vertical and Events authorities. It is declarative: the registry itself is not an execution or persistence authority.

## 4. Canonical authority boundaries

- **Commerce/Orders** owns order truth and lifecycle; Marketplace orchestrates seller/buyer workflows without duplicating order authority.
- **Inventory** owns stock/movement consequences; Warehouse, Restaurant, Agriculture, Procurement and Marketplace bridge to it.
- **Payments** owns payment evidence, decisions, refunds and settlement; Marketplace allocation/settlement consequences must remain coordinated with it.
- **Fulfillment/Logistics** owns physical-flow and delivery lifecycle boundaries; Scheduling is request-only until trusted operational feasibility exists.
- **Procurement** owns RFQ, supplier participation, response, comparison, award, purchase-order and receipt workflow; Supplier Network evidence is not a substitute for Procurement facts.
- **Supplier Network** owns supplier profile/capability/catalog/service-area/capacity/qualification/performance/trust evidence; performance and trust remain derived evidence over source facts.
- **Discovery** reads provider data and produces eligibility/ranking; it does not reserve, authorize, dispatch or execute.
- **Identity/Authorization** owns membership, role, scope and action policy; Pack activation and UI visibility cannot bypass server authorization.
- **Events/Audit** preserve durable event identity and audit lineage; helpers do not become a second event store.

## 5. Important persistence concentration

The SQLite store is more than a thin repository. Exported functions contain domain operations, validation, idempotency, transactions, cross-domain orchestration, audit writes and schema migrations. Its 110 tables span multiple logical domains, but table names are not sufficient evidence of ownership.

The route-to-store and function-to-table edges are recorded in:
- [Route characterization JSON](./route-characterization.json)
- [SQLite dependency map JSON](./sqlite-dependency-map.json)

Three high-severity current-main boundaries are confirmed:
1. Procurement receipt and multi-line Inventory posting are not one atomic transaction.
2. Payment refund/settlement audit calls pass the wrong positional arguments.
3. Payment refund/settlement request persistence is not atomic with its audit event.

See the [SQLite dependency map](./sqlite-dependency-map.md) for exact source lines and behavior.

## 6. Safe modularization decisions

### Do not extract yet

- Do not extract route modules before the 247 route entries have method-specific authorization, scope, validation, error, test and store transaction behavior verified.
- Do not extract transactional store functions across Payment/Marketplace, Procurement/Inventory, Fulfillment/Logistics, Service commitments, Supplier Network evidence or Identity/session boundaries.
- Do not split by Pack, vertical, URL prefix, or table-name prefix.
- Do not create a second database, ledger, event store, authorization engine, capacity authority or fulfillment authority.

### Candidate only

The SQLite inventory identifies 74 low-coupling read/projection candidates. They are a review queue, not approved extractions. Confirm helper dependencies, indirect calls, caller authorization, migration coupling and test coverage before moving any function.

### Preferred eventual structure

Keep the single deployable backend and shared SQLite connection initially. If extraction becomes safe, move cohesive functions behind existing capability/authority contracts while preserving the same transaction owner, audit lineage, idempotency and API behavior. Extract infrastructure and pure policy helpers before high-risk mutation clusters.

## 7. Conceptual distinctions

- **Capability:** logical action/service contract exposed to a consumer.
- **Authority:** canonical owner of state, decisions and invariants.
- **Pack:** organization-scoped bundle of capabilities, dependencies, roles and navigation/configuration.
- **Business template/vertical:** domain-specific composition using shared Core capabilities.
- **Experience:** user-facing journey, workspace and state presentation.
- **Channel:** Telegram, web, WhatsApp, SMS, POS/printing or another interaction path.

These concepts must not be collapsed. A Pack is not a new authority; a vertical is not a microservice boundary; a channel is not a domain owner.
