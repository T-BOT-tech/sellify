# Phase 17.1 — Procurement Demand Implementation

## Status

**Implemented in the Phase 16.14 source snapshot; not yet Node >=24 certified.**

Phase 17.1 establishes the deterministic Procurement Demand intake authority.
It does not implement supplier discovery, RFQ, supplier responses, comparison,
negotiation, award execution, B2B PO creation, Commerce Order execution,
fulfillment, inventory receipt, payment, settlement, or AI negotiation.

## Existing-source findings used for implementation

- SQLite is the existing backend persistence authority (`backend/lib/store-sqlite.js`).
- The latest pre-Phase-17 migration was version 20.
- Organizations and locations are already canonical identity/scope authorities.
- Catalog products remain the existing product authority.
- Central authorization is `backend/lib/authorization.js`.
- Audit history remains `audit_events` through `recordAuditEvent()` / the existing audit path.
- The platform capability/authority registries are declarative and do not own persistence.

## Implemented

### 1. Migration 21

Added:

- `procurement_demands`
- `procurement_demand_items`
- organization/request-number uniqueness
- organization/idempotency-key uniqueness
- organization/status/requester/source indexes
- positive quantity and non-negative target-price constraints
- foreign keys to organization, requester, location and demand
- submitted-demand immutability triggers
- submitted-demand-item update/delete protection

### 2. Demand authority

Added to `backend/lib/store-sqlite.js`:

- `createProcurementDemand()`
- `getProcurementDemand()`
- `listProcurementDemands()`
- `updateProcurementDemand()`
- `transitionProcurementDemand()`

The lifecycle is:

`DRAFT → SUBMITTED → SOURCING → AWARDED`

with cancellation/expiration branches from the non-terminal states. Phase
17.1 exposes only creation/editing, submit, cancel and start-sourcing. Award
is intentionally reserved for the later procurement award stage.

### 3. Input and integrity rules

- Quantity must be greater than zero.
- Unit is mandatory.
- Currency is explicit and normalized to the organization currency by default.
- Target price is integer minor-unit money and informational only.
- Product reference is optional; specification-first procurement is supported.
- If a product is referenced, it must belong to the tenant organization.
- Delivery location, when supplied, must belong to the organization and be active.
- Requester is taken from the authenticated actor, not trusted from the payload.
- Idempotency uses `(organization_id, idempotency_key)` plus a request hash.
- Reusing an idempotency key with a different payload returns a conflict.
- Submitted core fields and lines become immutable.
- Amendments after submission are deferred to an explicit future revision model.

### 4. Authorization

Added central permissions:

- `procurement:demand:view`
- `procurement:demand:create`
- `procurement:demand:manage`
- `procurement:demand:submit`
- `procurement:demand:cancel`
- `procurement:demand:sourcing`

Manager and owner retain management authority; the existing buyer role is
allowed to operate the demand workflow. No new authorization system exists.

### 5. API

- `GET /tenants/:chatId/procurement/demands`
- `POST /tenants/:chatId/procurement/demands`
- `GET /tenants/:chatId/procurement/demands/:id`
- `PATCH /tenants/:chatId/procurement/demands/:id`
- `POST /tenants/:chatId/procurement/demands/:id/submit`
- `POST /tenants/:chatId/procurement/demands/:id/cancel`
- `POST /tenants/:chatId/procurement/demands/:id/start-sourcing`

All routes use the existing session, tenant scope and central authorization
boundary.

### 6. Platform contract

Added `app/src/procurement/demand-contract.js` and registered
`procurement.demand` in the platform capability and authority registries.
The contract is declarative only. It explicitly declares that Procurement
Demand does not own inventory, payment ledger, supplier identity, B2B quotes,
or B2B purchase orders.

### 7. Audit

Demand creation and lifecycle transitions are recorded in the existing
`audit_events` authority with organization and actor context.

### 8. Regression

Added:

- `phase0/phase17.1-procurement-demand-regression.mjs`
- `phase0/phase17.1-procurement-demand-contract-regression.mjs`

The Phase 0 Golden Regression migration expectation was advanced from
versions 1–20 to versions 1–21 because Phase 17.1 is now part of the cumulative
platform schema.

## Explicitly not implemented yet

- Supplier identity/profile/network
- Buyer-supplier relationship
- RFQ
- Supplier Response
- Quote comparison
- Negotiation
- Award/split award
- Procurement → existing B2B Quote bridge
- Procurement → existing B2B Purchase Order bridge
- Approved PO → Commerce Order bridge
- Receiving / partial receipt
- Inventory PURCHASE execution
- Procurement payment allocation
- Procurement settlement
- Procurement-specific offline UI/outbox consumer
- AI procurement or AI negotiation

These remain later Phase 17 stages and must not be simulated by Demand.

## Validation performed

- Phase 17.1 Demand Regression: **PASS**
- Phase 17.1 Demand Contract Regression: **PASS**
- Phase 0 Golden Regression: **21 PASS / 0 FAIL**
- Phase 16.12 Platform Regression: **PASS**
- Runtime observed during validation: **Node v22.16.0**
- Node >=24 certification: **still blocked/deferred**, consistent with Phase 16.14.

## Next implementation stage

**Phase 17.2 — Supplier Participation & Discovery foundation** should begin only
after the Phase 17.1 contract is frozen. It should reuse Organization/Tenant
identity, explicitly distinguish Supplier participation from Marketplace Seller
identity, and avoid introducing a duplicate Supplier identity authority.
