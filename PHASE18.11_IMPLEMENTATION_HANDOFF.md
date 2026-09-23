# PHASE 18.11 — MARKETPLACE / ECOSYSTEM INTEGRATION

**Status:** IMPLEMENTED / REGRESSION PASS

## Purpose

Connect the existing Marketplace/Product authority with the Supplier Network without creating a second seller identity, second product authority, or automatic supplier enrollment.

## Boundary

```text
Organization
   ├── Marketplace/Product Core
   │      └── marketplace listings
   └── Procurement
          └── explicit supplier participation
                 └── Supplier Network

Integration = read-only cross-domain projection
```

## Rules

- Organization remains the canonical identity.
- Marketplace Seller is not automatically a Procurement Supplier.
- Marketplace/Product Core remains authoritative for marketplace listings, prices, and stock exposure.
- Procurement remains authoritative for supplier participation.
- Supplier Network remains authoritative for supplier-network profile/catalog data.
- The integration does not mutate marketplace, procurement, supplier-network, inventory, or payment state.
- No duplicate seller/supplier identity is created.

## Integration API

`GET /tenants/:chatId/supplier-network/marketplace-integration`

`GET /tenants/:chatId/supplier-network/marketplace-integration/:supplierOrganizationId`

The response exposes:

- canonical organization identity
- procurement supplier participation state
- published Supplier Network state
- marketplace presence and marketplace listing projection
- Supplier Network catalog listings with marketplace listing correlation where the canonical product is marketplace-listed
- explicit authority ownership
- explicit read-only mutation boundary

Cross-organization inspection requires active, discoverable supplier participation and a visible published Supplier Network profile. Visibility rules remain those of Supplier Network discovery.

## Discovery integration

Phase 18.10 deterministic discovery results now include a `marketplace` projection for each discovered supplier organization. This is informational only and does not change deterministic ranking or supplier eligibility.

## Capability

`supplier-network.marketplace-integration` / action `view`

## Authority registry

Supplier Network authority now includes `marketplace_integration` as a read-model domain. The underlying marketplace data remains owned by Commerce/Product authority.

## Persistence

No new database table or migration is required. The integration is deliberately derived from existing authoritative tables. This keeps Phase 18.11 additive and avoids introducing an unnecessary integration ledger/state store.

## Regression

- Phase 18.11 targeted regression: PASS
- Phase 18.10 targeted regression: PASS
- Phase 17.10 cumulative exit gate: PASS
- Phase 0 Golden: 21 PASS / 0 FAIL
- Node >=24 certification remains deferred to Phase 16.13; observed runtime is Node 22.16.0.
