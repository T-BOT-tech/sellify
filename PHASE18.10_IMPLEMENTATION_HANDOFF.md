# PHASE 18.10 — DETERMINISTIC SUPPLIER NETWORK DISCOVERY

## Status
IMPLEMENTED / REGRESSION PASS

## Purpose
Expose deterministic, explainable supplier discovery over the Phase 18 Supplier Capability Graph. This phase deliberately does not introduce an LLM or AI authority.

## Sources
- Organization identity remains canonical.
- Procurement supplier participation/discoverability remains authoritative for network eligibility.
- Supplier Network profile, capability, catalog, service area, capacity, commercial terms, qualification, performance, and trust evidence remain authoritative for their respective network data.

## Discovery inputs
- search
- productId
- capabilityCode
- countryCode
- geoCode
- currency
- minimumQuantity
- wholesale
- bulkOrder
- qualificationType
- limit

## Deterministic ranking
Match dimensions contribute fixed, explainable weights: product 30, capability 20, geography/country 10/15, capacity 5/10, commercial 10, qualification 5/10, active relationship 5. Filters are hard constraints when explicitly requested. Ties are resolved by organization name then organization ID. The score is a discovery match score, not a trust/reputation score.

## Visibility
Only PUBLIC, NETWORK, or relationship-authorized RELATIONSHIP records are exposed. PRIVATE and CONFIDENTIAL records are excluded. Profile visibility is enforced before candidate discovery.

## AI boundary
The endpoint returns `deterministic: true` and `ai: false`. Future AI may translate natural-language demand into structured discovery filters or explain results, but cannot replace the deterministic authority or award suppliers.

## API
- GET `/tenants/:chatId/supplier-network/discovery`
- POST `/tenants/:chatId/supplier-network/discovery`

## Capability
`supplier-network.discovery` / action `discover`

## Mutation boundary
Discovery is read-only with respect to supplier/product/procurement/payment/inventory/marketplace authorities. It emits only an audit event for the discovery operation.

## Regression
- Phase 18.10 targeted regression: PASS
- Phase 18.1–18.10 cumulative: PASS
- Phase 17 cumulative: PASS
- Phase 16.12: PASS
- Phase 0 Golden: PASS
- Node >=24 certification remains deferred to Phase 16.13 because the observed runtime is Node 22.16.0.
