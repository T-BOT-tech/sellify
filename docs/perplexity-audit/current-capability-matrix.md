# Current capability matrix

## Purpose

This matrix separates verified or explicitly documented capabilities from unresolved architectural boundaries.

It is a planning aid, not a replacement for executable tests or runtime verification.

## Capability status

| Capability | Status | Evidence / boundary |
|---|---|---|
| Multi-tenant platform foundation | Implemented / verify continuously | Tenant-isolation, authorization, security-context, and organization-isolation modules and tests exist. |
| Authorization and role boundaries | Implemented / verify continuously | Dedicated authorization, resource-action registry, role matrix, and security-context modules exist. |
| Event outbox and replay | Implemented / verify continuously | Event replay, failure isolation, outbox integration, and tenant-scope tests are present. |
| Offline-first PWA | Implemented / requires deeper verification | The repository describes an offline-first PWA in `app/`; runtime offline behavior requires frontend inspection and browser tests. |
| Commerce and storefront | Implemented / requires deeper verification | Storefront, checkout, payment-state, cross-channel, and seller-journey regressions exist. |
| Procurement | Implemented / extensive | Demand, RFQ, comparison, award, PO bridge, receiving, settlement, and immutable RFQ-time supplier capacity evidence snapshots have targeted regression coverage. |
| Supplier Network | Implemented / extensive | Supplier profile, capability, catalog, service area, commercial, qualification, performance, discovery, and marketplace integration tests exist. |
| Discovery and matching | Implemented / bounded capacity evidence path | Deterministic eligibility and ranking are implemented. Time-bound capacity matching enforces active status, SELF_REPORTED quality, observedAt, validUntil, evaluatedAt, period overlap, quantity, and unit; matching does not select, authorize, or execute providers. |
| Warehouse and inventory | Implemented / extensive | Warehouse boundary, receiving, stock adjustment, inventory bridge, canonical mutation, and replay tests exist. |
| Fulfillment | Implemented / requires deeper verification | Fulfillment bridge, lifecycle, unified fulfillment, and frontend authority regressions exist. |
| Logistics | Partial | Logistics boundary, proof, returns, courier assignment, routes, tracking, and cross-feature tests exist; operational scheduling lacks a trusted capacity authority. |
| Logistics Scheduling | Request-only | The existing evaluator treats caller feasibility claims as untrusted; `REQUESTED` cannot become `SCHEDULED` without a trusted feasibility decision. |
| Payments | Implemented / requires deeper verification | Payment core, provider, procurement payment, frontend contract, integration, projection, and stale-state tests exist. |
| B2B commerce | Implemented / extensive | Quotes, PO approval, credit terms, accounts receivable, invoices, and custom-pricing regressions exist. |
| Telegram commerce | Implemented / requires deeper verification | Storefront, BYOB credentials, buyer identity, checkout, orders, fulfillment, and security regressions exist. |
| Country packs | Implemented / extensive | Ethiopia, Tanzania, CEMAC, compliance, currency, tax, phone/address, and cross-country regressions exist. |
| Vertical packs | Implemented / extensive | Agriculture, restaurant, warehouse, service booking, and cross-pack integration regressions exist. |
| AI procurement / discovery | Partial | AI intent, procurement context, evidence, preparation, explanation, and authorization tests exist; production readiness requires deeper review. |
| Operational scheduling | Not implemented | No trusted capacity/feasibility authority is wired to the L11 evaluator. |
| Time-bound capacity evidence matching | Implemented / bounded; independent verification partial | The current Discovery path fails closed for missing, stale, expired, future-observed, unknown, conflicting, or insufficiently valid evidence. Supplier declarations with a server-authored observedAt are normalized as SELF_REPORTED; legacy declarations without it remain UNKNOWN. OBSERVED/VERIFIED evidence requires a trusted independent observer binding that does not yet exist. Legacy quantity-only searches retain a less strict path. |

## Interpretation

- **Implemented** means the repository contains direct implementation and targeted regression coverage.
- **Partial** means a meaningful implementation exists but a material boundary, integration, or evidence gap remains.
- **Request-only** means the workflow can record or coordinate requests but cannot safely perform the operational action.
- **Not implemented** means no trusted execution path currently exists.
- **Requires deeper verification** means implementation evidence exists, but this audit has not yet inspected every runtime path.

## Immediate unresolved decisions

1. Define the trusted operational owner and evidence contract for Logistics Scheduling feasibility; current Discovery matching is not that authority.
2. Explicitly accept or reject SELF_REPORTED supplier capacity as sufficient evidence for each hard time-sensitive use case; the current bounded matcher permits it only when its server-authored observation and validity checks pass.
3. Define the trusted observer identity, provenance, and authorization contract required before OBSERVED or VERIFIED evidence can be accepted.
4. Review legacy quantity-only capacity consumers before using them for hard time-sensitive decisions; do not assume they inherit the time-bound matcher's freshness guarantees.
5. Keep operational scheduling request-only until the trusted feasibility path and its authorization, tenant/location scope, and side-effect boundaries are implemented and tested.
6. Define the long-term persistence strategy beyond SQLite.


## Current-main boundary clarification (2026-11-23)

The strict time-bound capacity checks apply in the unified `/api/discovery` flow. The direct `/tenants/:chatId/supplier-network/discovery` route calls the legacy store discovery function directly and retains quantity-only capacity ranking without freshness, validity, period-overlap, or unit enforcement. Do not use that direct legacy result for hard time-sensitive decisions. See `docs/audit/capacity-scheduling-boundary.md`.

A separate route authorization gap was confirmed: `GET/POST /tenants/:chatId/payments/routing/policies` require a tenant session but do not enforce the central `payments:view` / management permission boundary. See `docs/audit/route-characterization.md`.
