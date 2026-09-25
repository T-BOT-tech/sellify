# Phase 10.2 — Organization & Location Foundation

Phase 10.2 extends the additive identity foundation from Phase 10.1.

## Canonical location types

- `STORE`
- `WAREHOUSE`
- `COLLECTION_CENTER`
- `DELIVERY_HUB`
- `OFFICE`
- `RESTAURANT`

Statuses:

- `active`
- `inactive`

## Compatibility rule

The Phase 6 `tenants` table and `chat_id` remain compatible and authoritative for existing tenant-scoped routes. Each tenant continues to receive exactly one canonical default `STORE` location. New locations are attached to the tenant's canonical organization.

## HTTP contract

Authenticated tenant-scoped routes:

- `GET /tenants/:chatId/locations`
- `POST /tenants/:chatId/locations`
- `PATCH /tenants/:chatId/locations/:locationId`

Viewing requires an active tenant session with the canonical `locations:view` permission. Creating/updating requires the canonical `locations:manage` permission enforced by the central authorization layer.

The Warehouse → Locations management UI is a canonical client of these routes. The legacy `warehouseLocations` storage-bin list remains a separate local compatibility surface and must not be treated as organization-location authority.

## Migration

Migration 7 adds organization/location indexes and locks the canonical location contract at the service boundary without rewriting existing rows.

No inventory, order, catalog, or sync semantics are switched to location-aware behavior in this phase. That belongs to the later Inventory Ledger and authorization work.
