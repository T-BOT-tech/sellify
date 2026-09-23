# Phase 14.12 — Ethiopia Integration

## Objective
Connect the Ethiopia country pack to the canonical event/outbox path without introducing a country event store, broker, consumer registry, or duplicate domain authority.

## Authority boundaries
- Country identity/configuration: existing Phase 14 country projections and organization identity remain authoritative.
- Event envelope: `app/src/events/event-boundary.js`.
- Durable outbox: `app/src/sync/outbox.js#enqueueEvent`.
- Backend consumer: `backend/lib/store-sqlite.js#processSyncEvent`.
- Existing backend-supported event types only: `inventory.movement.record`, `customer.upsert`.

## Implementation
`app/src/country-event-integration.js` adds `country_code: ET` to the canonical versioned event metadata and delegates enqueueing to the existing versioned-event/outbox boundary.

No country persistence, event broker, event store, consumer registry, payment ledger, inventory ledger, or authorization evaluator is introduced.

## Fail-closed rule
Country events are accepted only for the Ethiopia pack and only for event types already supported by the existing backend consumer. New Ethiopia-specific event types require a corresponding canonical backend consumer before activation.

## Verification
`phase0/phase14.12-ethiopia-integration-regression.mjs` verifies canonical envelope metadata, existing outbox handoff, unsupported-event rejection, and absence of duplicate event infrastructure.
