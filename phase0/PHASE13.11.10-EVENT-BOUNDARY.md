# Phase 13.11.10 — Event Boundary

## Objective

Formalize the canonical event envelope at the existing Transaction → Outbox → Versioned Event → Consumer boundary without creating a second event store, broker, consumer registry, or domain authority.

## Actual source inspected

Before implementation, the current Phase 13.11.9 source was inspected, including:

- `app/src/sync/outbox.js`
- `app/src/state.js`
- `app/src/constants.js`
- `backend/lib/store-sqlite.js`
- `backend/server.js`
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/physical-flow.js`
- `app/src/logistics/unified-fulfillment-contract.js`
- existing Phase 10.7 Outbox/Event regression
- existing Phase 13.11.9 Unified Fulfillment regression

The inspection confirms that the existing durable outbox uses `enqueueEvent()` and the backend uses `processSyncEvent()` with the `sync_events` table and `event_id` primary key for replay protection.

## Canonical event flow

```text
Transaction
   ↓
Existing Outbox
   ↓
Versioned Event Envelope
   ↓
Existing Consumer / sync handler
```

The phase preserves the project's established boundary:

```text
Transaction → Outbox → Versioned Event → Consumer
```

## Implementation

Added:

`app/src/events/event-boundary.js`

The module provides:

- `buildVersionedEvent()` — pure canonical envelope construction
- `isVersionedEvent()` — envelope validation
- `toOutboxEvent()` — compatibility mapping to the existing outbox shape
- `enqueueVersionedEvent()` — dependency-injected handoff to existing `enqueueEvent()`
- `eventBoundaryContract()` — architectural contract declaration

The versioned envelope carries:

- event version
- event type
- event identity
- aggregate type/id
- organization identity
- payload
- occurrence time
- correlation identity
- causation identity
- idempotency identity
- metadata

## Source of truth

| Concern | Authority |
|---|---|
| Domain aggregate state | Existing owning domain/Core transaction |
| Local durable outbox | `app/src/sync/outbox.js#enqueueEvent` |
| Backend event deduplication/storage | `backend/lib/store-sqlite.js#processSyncEvent` / `sync_events` |
| Event consumers | Existing supported `processSyncEvent` handlers |
| Event envelope semantics | `app/src/events/event-boundary.js` |

The new boundary does **not** become the authority for aggregate state.

## Compatibility / migration

No schema migration was required.

The existing outbox record shape remains unchanged. `toOutboxEvent()` places the versioned envelope metadata under the existing event payload's `_event` compatibility namespace, while preserving the existing top-level `eventId`, `eventType`, `aggregateType`, `aggregateId`, and `occurredAt` fields.

No existing producer was rewritten in this increment. Existing event producers remain compatible.

## Idempotency

`event_id` remains the canonical event identity. The existing backend `sync_events.event_id` uniqueness remains authoritative for replay protection.

The versioned envelope additionally carries `idempotency_key`, defaulting to `event_id` when no separate key is supplied.

## Explicit non-goals

- No new event database/table.
- No new event broker or bus.
- No consumer registry.
- No replacement of `sync_events`.
- No replacement of the existing Outbox.
- No automatic event publication from domain code.
- No duplicate domain authority.
- No route/dispatch implementation.
- No direct inventory or stock mutation.

## Regression

`phase0/phase13.11.10-event-boundary-regression.mjs`

The regression verifies:

1. versioned event envelope construction;
2. organization, aggregate and idempotency identity;
3. compatibility mapping to the existing Outbox shape;
4. dependency-injected handoff to the existing enqueue capability;
5. absence of event-store/broker/consumer replacement;
6. preservation of backend `sync_events` authority;
7. no direct domain persistence or stock mutation.

## Runtime

Observed environment: Node `v22.16.0`.

Project requirement remains Node `>=24`. This phase does not lower or alter that requirement and does not claim Node >=24 certification.
