# PHASE 18.4 — SUPPLIER NETWORK SERVICE AREAS

Status: IMPLEMENTED / REGRESSION PASS
Baseline: Phase 18.3 Supplier Network Catalog
Migration: 33

## Scope
Adds persistent supplier service-area declarations without creating a country-specific geography authority.

## Authority
- Organization remains canonical supplier identity.
- Supplier Network owns service-area declarations.
- Country Packs / normalized geography providers define geographic hierarchy semantics.
- Procurement, Product, Inventory, Payment, Marketplace and financial authorities are unchanged.

## Data
`supplier_network_service_areas`

Supported scope types:
COUNTRY, REGION, ZONE, DISTRICT, CITY, POSTAL_CODE, RADIUS

Visibility:
PUBLIC, NETWORK, RELATIONSHIP, PRIVATE, CONFIDENTIAL

Status:
ACTIVE <-> INACTIVE

RADIUS supports positive radius_km and optional validated latitude/longitude. Non-radius scopes cannot carry radius geometry.

## API
GET/POST `/tenants/:chatId/supplier-network/service-areas`
GET/PATCH `/tenants/:chatId/supplier-network/service-areas/:id`
POST `/tenants/:chatId/supplier-network/service-areas/:id/activate`
POST `/tenants/:chatId/supplier-network/service-areas/:id/deactivate`

## Capability
`supplier-network.service-area`

## Events
- supplier.network.service_area.created
- supplier.network.service_area.updated
- supplier.network.service_area.activated
- supplier.network.service_area.deactivated

## Regression
- Phase 18.4 service-area regression: PASS
- Phase 18.3 catalog regression: PASS
- Phase 18.2 capability regression: PASS
- Phase 18.1 profile regression: PASS
- Phase 16.12 platform regression: PASS
- Phase 0 Golden Regression: PASS
- Runtime observed: Node v22.16.0
- Node >=24 certification remains deferred to Phase 16.13.
