# Phase 14.11 — Country Events / Outbox

Country event integration is an adapter over the existing versioned event and durable outbox boundaries.

Flow: `Country Capability → Versioned Event → Existing Outbox → Existing Backend Consumer`.

`app/src/country-event-integration.js` adds canonical `country_code` metadata and delegates envelope creation to `app/src/events/event-boundary.js` and persistence to `app/src/sync/outbox.js#enqueueEvent`.

No country event store, broker, consumer registry, event dispatcher, payment ledger, inventory ledger, or domain authority is introduced. Unsupported country packs fail closed.
