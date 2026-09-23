# Phase 13.12.14 — Events / Outbox Integration

## Objective

Connect vertical-pack event production to the existing versioned event envelope and durable outbox without introducing a new event store, broker, consumer registry, or domain authority.

## Existing authorities

| Concern | Authority |
|---|---|
| Versioned event envelope | `app/src/events/event-boundary.js` |
| Durable client outbox | `app/src/sync/outbox.js#enqueueEvent` |
| Backend event persistence / processing | `backend/lib/store-sqlite.js#processSyncEvent` / `sync_events` |
| Event replay identity | existing `sync_events.event_id` + Phase 13.11.11 replay boundary |
| Event failure isolation | Phase 13.11.12 failure isolation boundary |
| Vertical domain state | existing vertical/Core authorities |

## Implementation

Added `app/src/verticals/event-integration.js` as a persistence-neutral adapter.

It provides:

- `buildVerticalVersionedEvent()` — composes a vertical pack identifier into the existing canonical event envelope;
- `enqueueVerticalVersionedEvent()` — hands a supported event to the existing `enqueueEvent()` outbox capability;
- `verticalEventIntegrationContract()` — records the authority and compatibility boundary.

The adapter supports the four existing vertical pack identifiers:

- agriculture
- restaurant
- warehouse
- logistics

The current backend only processes:

- `inventory.movement.record`
- `customer.upsert`

Therefore unsupported vertical event types fail closed instead of being queued for a backend consumer that does not exist yet.

## Security boundary

This phase does not create a second event authorization evaluator. Event authorization remains part of the established Phase 13.12 security architecture and future event-specific authorization work remains bounded separately.

Organization identity remains part of the canonical event envelope. Pack identity is metadata and does not grant authorization or create a pack-specific event ACL.

## Persistence boundary

No new:

- event database/table
- broker
- message bus
- consumer registry
- retry queue
- audit store
- authorization store
- configuration store

was introduced.

## Compatibility rule

A vertical event may be constructed as a canonical versioned event, but it may only enter the durable outbox when its event type has an existing backend consumer. New event types require a future consumer implementation before publication is enabled.

## Regression coverage

The regression verifies:

- all four vertical packs are recognized;
- vertical event envelopes remain canonical versioned events;
- pack identity is carried as metadata only;
- supported event types use the existing outbox handoff;
- unsupported event types fail closed;
- organization identity remains mandatory;
- duplicate event/outbox/consumer authorities are not introduced;
- no browser storage or backend database is created by the adapter;
- existing Phase 13.11 event boundary remains unchanged;
- Phase 13.13 configuration remains separate;
- Phase 13.12 authorization remains separate from event publication.
