# PHASE 18.1 — SUPPLIER NETWORK PROFILE IMPLEMENTATION HANDOFF

**Date:** 2026-09-11
**Baseline:** `SELLIFY_PHASE17_10_CUMULATIVE_EXIT_GATE_2026-09-11`
**Status:** IMPLEMENTED — REGRESSION PASS

## Scope

Phase 18.1 implements the first persistent Supplier Network layer: the Supplier Network Profile.

The implementation deliberately preserves Phase 17 authority boundaries:

- Organization remains the canonical identity.
- Existing Procurement Supplier Participation remains the prerequisite/participation authority.
- No second supplier identity was created.
- Product, Marketplace Seller, PO, Inventory, Payment, Settlement and Audit authorities remain unchanged.
- Supplier Network Profile is descriptive/network-facing metadata only.

## Persistence

Migration `30` creates:

` supplier_network_profiles `

One row per Organization (`organization_id` primary key).

Fields include:

- display name
- description
- business categories
- service summary
- primary contact reference
- website reference
- visibility
- lifecycle status
- publication/suspension timestamps
- actor/audit metadata
- optimistic version

Visibility:

`PUBLIC | NETWORK | RELATIONSHIP | PRIVATE | CONFIDENTIAL`

Lifecycle:

`DRAFT → PUBLISHED | SUSPENDED`

`PUBLISHED → DRAFT | SUSPENDED`

`SUSPENDED → DRAFT | PUBLISHED`

Publishing requires active Procurement Supplier Participation.

## API

- `GET /tenants/:chatId/supplier-network/profile`
- `POST /tenants/:chatId/supplier-network/profile`
- `PATCH /tenants/:chatId/supplier-network/profile`
- `POST /tenants/:chatId/supplier-network/profile/publish`
- `POST /tenants/:chatId/supplier-network/profile/suspend`
- `POST /tenants/:chatId/supplier-network/profile/draft`

These endpoints are tenant/session scoped and centrally authorized.

## Platform Contracts

Added:

`app/src/supplier-network/profile-contract.js`

Capability:

`supplier-network.profile`

Authority:

`supplier_network`

The canonical platform authority registry now explicitly contains Supplier Network as a domain authority rather than incorrectly treating richer network features as Procurement.

## Authorization

Manager permissions added:

- `supplier-network:view`
- `supplier-network:manage`
- `supplier-network:publish`
- `supplier-network:suspend`

Owner retains access through the existing wildcard permission.

## Audit

Profile mutations use the existing audit authority with actions including:

- `supplier.network.profile.created`
- `supplier.network.profile.updated`
- `supplier.network.profile.published`
- `supplier.network.profile.suspended`
- `supplier.network.profile.draft`

No second audit store was introduced.

## Regression

Phase 18.1 targeted regression:

`phase0/phase18.1-supplier-network-profile-regression.mjs`

Verified:

- contract version and identity authority
- visibility vocabulary
- legal lifecycle transitions
- supplier participation prerequisite
- profile creation
- category normalization/deduplication
- organization identity preservation
- publication timestamp
- version increment on update
- suspension and redraft
- non-supplier rejection

Cumulative controls:

- Phase 17.10 cumulative gate: **PASS**
- Phase 17 regressions: **19 PASS / 0 FAIL**
- Phase 16.12: **PASS**
- Phase 0 Golden: **21 PASS / 0 FAIL**
- Runtime observed: **Node v22.16.0**
- Node >=24 certification remains deferred to Phase 16.13.

## Next

`PHASE 18.2 — SUPPLIER CAPABILITIES`

The next stage should add machine-readable supplier capabilities while continuing to use Organization as identity and keeping Procurement transactional authority intact.
