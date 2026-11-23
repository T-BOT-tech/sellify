# Sellify architecture map

## Product shape

Sellify is an offline-first, multi-tenant commerce and operations platform.

Its scope spans buyer and seller commerce, procurement, supplier networks, inventory, warehouse operations, fulfillment, logistics, payments, Telegram channels, country packs, and vertical business capabilities.

## Repository layout

| Area | Location | Role |
|---|---|---|
| PWA frontend | `app/` | Vanilla HTML/CSS/ES-module browser application, PWA shell, and operational workspaces. |
| Backend API | `backend/server.js` | HTTP server, route handling, and orchestration. |
| Backend libraries | `backend/lib/` | Authorization, tenant isolation, events, discovery, logistics, payments, and vertical boundaries. |
| HTTP response helper | `backend/lib/http/response.js` | Shared JSON response headers, CORS response policy, request IDs, and structured error redaction; server retains configuration and wrapper signatures. |
| Persistence | `backend/lib/store-sqlite.js` | SQLite-backed persistence and domain store logic. |
| Regression suite | `phase0/` | Phase-specific contract, security, integration, adversarial, and runtime tests. |
| Delivery documents | repository root | Phase handoffs, certification evidence, hashes, and gap analyses. |
| Operations | `scripts/`, `.github/`, `.devcontainer/`, `.env.example` | Development, CI, container, and deployment support. |

## Technology inventory

| Layer | Technology | Observation |
|---|---|---|
| Runtime | Node.js with ESM | The project targets a Node 24 runtime gate. |
| Backend | Node.js HTTP server | `backend/server.js` is 274,791 characters and currently contains 247 explicit route entries, 6 inline dispatch branches, and 137 distinct named handlers. |
| Persistence | SQLite | `backend/lib/store-sqlite.js` is 971,694 characters, with 253 exported functions, 947 literal SQL statements, and 110 unique tables. |
| Frontend | Vanilla HTML/CSS and browser ES modules; PWA | `app/index.html` is the main shell; `app/src/main.js` imports local ES modules. `app/package.json` has no React, Vue, Angular, Svelte, or other frontend framework dependency. |
| Testing | Node regression scripts | Extensive but highly fragmented across npm scripts. |
| Integrations | Telegram, payments, logistics, country packs | Broad external and vertical integration surface. |

## Architectural strengths

- Explicit concern for tenant isolation, authorization, auditability, idempotency, event replay, and failure isolation.
- Extensive regression and adversarial test intent.
- Clear separation between frontend, backend, shared code, scripts, and documentation.
- Broad domain coverage with deliberate authority-boundary language.

## Principal risks

1. `backend/server.js` concentrates too much routing and orchestration.
2. `backend/lib/store-sqlite.js` concentrates too much persistence and domain logic.
3. The npm script surface has 482 entries and remains fragmented; 11 exact-command duplicate groups and missing generic test wrappers complicate navigation.
4. Root-level phase documentation obscures the current product state.
5. The unified Discovery path has fail-closed time-bound capacity matching, but the direct legacy Supplier Network discovery route remains quantity-only; independent observer provenance and operational scheduling feasibility remain unresolved.
6. The platform may be accumulating overlapping authorities unless domain ownership is made explicit.

## Domain ownership baseline

| Domain | Proposed canonical owner |
|---|---|
| Identity and access | IAM / authorization modules |
| Tenant and location scope | Tenant isolation and security-context modules |
| Orders and fulfillment | Existing order/fulfillment authorities |
| Inventory | Inventory ledger authority |
| Procurement | Procurement domain |
| Supplier capacity evidence | Supplier Network source-of-truth module |
| Logistics scheduling | Logistics Scheduling coordination module, pending a trusted feasibility authority |
| Payments | Payment core and provider adapters |
| Events | Event outbox and replay infrastructure |

No new domain should silently assume ownership of another domain's canonical records.


## Current-main audit refresh (2026-11-23)

The current route and persistence maps are now maintained in `docs/audit/route-characterization.md` and `docs/audit/sqlite-dependency-map.md`. The current test and capacity boundaries are in `docs/audit/test-command-map.md` and `docs/audit/capacity-scheduling-boundary.md`. These maps are source snapshots at `e216db18ade2a5ffa66aff9dc3096e207251a918`; no module extraction is approved. A confirmed Payment routing policy permission gap is recorded in the route map.
