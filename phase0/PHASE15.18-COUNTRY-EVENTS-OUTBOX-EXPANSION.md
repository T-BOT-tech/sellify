# Phase 15.18 — Country Events / Outbox Expansion

## Scope
Expand country event/outbox integration metadata for the active country packs while preserving the canonical versioned event envelope, existing outbox, and existing backend consumer.

## Canonical authorities
- Event envelope: `app/src/events/event-boundary.js`
- Outbox persistence: `app/src/sync/outbox.js#enqueueEvent`
- Backend consumer: `backend/lib/store-sqlite.js#processSyncEvent`
- Existing Ethiopia integration: `app/src/country-event-integration.js`

## Activation
- ET, KE, TZ, NG: active country-pack event boundary.
- GH, ZM: strategic candidates; fail closed until explicit country-pack activation.
- Other EAC/WAEMU/CEMAC members: regional-country-boundary-only; fail closed until a country overlay exists.
- Unknown country: fail closed.

## Event types
Only the existing backend consumer event types are accepted:
- `inventory.movement.record`
- `customer.upsert`

No new country event types are executable until an existing canonical backend consumer contract exists.

## Forbidden architecture
No country event store, regional event store, broker, event bus, consumer registry, country domain authority, or duplicate outbox was introduced.

## Flow
`Country Capability → Canonical Versioned Event → Existing Outbox → Existing Backend Consumer`

## Status
Implementation status: boundary_only.
Node >=24 certification remains a separate pending release gate.
