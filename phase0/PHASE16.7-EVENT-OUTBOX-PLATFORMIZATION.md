# Phase 16.7 — Event / Outbox Platformization

## Status
PASS — implementation complete; Node >=24 certification remains pending globally.

## Purpose
Formalize the existing `Transaction → Outbox → Versioned Event → Consumer` flow for platform consumers without creating a second event infrastructure.

## Implemented
- `app/src/platform/event-outbox-platform.js`
- platform exports via `app/src/platform/index.js`
- `phase0/phase16.7-event-outbox-platformization-regression.mjs`
- `package.json` script `test:phase16.7`
- source hash manifest

## Authority preservation
- Versioned event envelope: `app/src/events/event-boundary.js`
- Outbox persistence: `app/src/sync/outbox.js#enqueueEvent`
- Backend event consumer: `backend/lib/store-sqlite.js#processSyncEvent`

## Explicit non-goals
No new event store, broker, consumer registry, persistence layer, ledger, transaction engine, authorization authority, or domain authority.

## Supported executable event types
- `inventory.movement.record`
- `customer.upsert`

Unsupported platform event types fail closed until an existing backend consumer exists.
