# Sellify Phase 13.11.18 — Integration Matrix

## Purpose

Phase 13.11.18 is a control/regression phase. It does not add a new domain authority, persistence layer, event bus, route engine, dispatch engine, or cross-pack orchestrator.

The matrix proves that the implemented cross-pack topology remains **hub-and-contract**:

`Vertical Pack → Canonical Core Capability → Canonical Authority`

## Allowed integration edges

| Source | Canonical target | Actual authority / contract surface |
|---|---|---|
| Commerce | Fulfillment | `physical-commerce/spine-contract.js` → existing Core Fulfillment |
| Commerce | Inventory | existing Commerce/Product + Inventory authority surfaces |
| Warehouse | Inventory | `warehouse/inventory-contract.js` → `warehouse/inventory.js` + ledger |
| Warehouse | Fulfillment / Logistics | `warehouse/fulfillment-boundary.js` → existing Core Fulfillment |
| Restaurant | Commerce / Inventory | `restaurant/commerce-inventory-contract.js` |
| Restaurant | Warehouse / Logistics | `restaurant/warehouse-logistics-contract.js` |
| Agriculture | Commerce / Inventory | `agriculture/commerce-inventory-contract.js` |
| Agriculture | Warehouse / Logistics | `agriculture/warehouse-logistics-contract.js` |
| Logistics | Commerce / Fulfillment / Inventory | `logistics/fulfillment-boundary.js` + `cancellation-return-contract.js` |
| Returns | Commerce / Fulfillment / Inventory | `cancellation-return-contract.js` |
| Events | Outbox / sync_events | `events/event-boundary.js` + existing backend replay authority |
| Authorization | Tenant / organization / location | `backend/lib/tenant-isolation.js` + existing session/authorization authorities |
| All verticals | Customers / Locations / Audit | existing Core dependencies + `audit/audit-boundary.js` |

The regression contains 25 declared allowed edge assertions, including shared Core boundaries.

## Authority continuity

The regression loads the actual persistence-neutral contract surfaces and asserts:

- Commerce remains Order/Product authority.
- Payments remains Payment authority.
- Inventory remains stock/movement authority.
- Warehouse remains Warehouse workflow authority.
- Core Fulfillment remains fulfillment lifecycle authority.
- Logistics remains physical coordination / Return workflow authority.
- Locations and Customers remain shared authorities.
- Existing Outbox and backend `sync_events` remain event persistence authorities.
- Existing `audit_events` remains audit history authority.
- Tenant organization/location boundaries remain under existing session/authorization models plus the Phase 13.11.14 policy boundary.

## Forbidden topology

The regression explicitly blocks:

- arbitrary N×N vertical-to-vertical implementation paths;
- Agriculture ↔ Restaurant direct integration;
- duplicate Order, Inventory, Payment, Customer, Location, Fulfillment, Ledger, Audit, Replay, or Return authorities;
- new cross-pack orchestrator/god-service artifacts;
- route/dispatch implementation;
- direct vertical persistence;
- direct vertical stock mutation.

Agriculture and Restaurant intentionally converge through canonical Commerce / Inventory / Fulfillment capabilities rather than acquiring a new point-to-point contract.

## Test

`node phase0/phase13.11.18-integration-matrix-regression.mjs`

Expected result:

```text
Phase 13.11.18 Integration Matrix Regression: PASS
Allowed integration edges declared: 25
Actual contract surfaces: PASS
Commerce / Inventory / Payments authority continuity: PASS
Warehouse / Restaurant / Agriculture / Logistics edge continuity: PASS
Events / Outbox / sync_events boundary continuity: PASS
Returns / Fulfillment / Inventory continuity: PASS
Authorization / tenant / location boundary anchor: PASS
Audit / tenant / correlation boundary anchor: PASS
Forbidden N×N vertical implementation paths: BLOCKED
Agriculture ↔ Restaurant direct integration: BLOCKED
Route / Dispatch implementation: BLOCKED
```

## Scope decision

No production domain source was changed for Phase 13.11.18. The only source change is the package test script; the implementation artifact is the regression/control file and this documentation/hash record.

Node `>=24` remains the project requirement. This phase does not certify runtime compatibility because the current environment is Node 22.16.0.
