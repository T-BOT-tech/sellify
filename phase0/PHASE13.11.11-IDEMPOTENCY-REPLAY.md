# Phase 13.11.11 — Idempotency / Replay

**Status:** COMPLETE — 2026-09-08

## Objective

Harden the Phase 13.11.10 event boundary so retries are deterministic without
introducing a second event store, replay database, broker, or consumer authority.

## Actual source inspected

- `app/src/events/event-boundary.js`
- `app/src/sync/outbox.js`
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- existing inventory event-id guards
- existing marketplace idempotency implementation
- Phase 13.11.10 regression

## Canonical decision

The existing `sync_events.event_id` remains the durable event identity authority.
Phase 13.11.11 adds deterministic payload comparison around that existing record.

```text
first event
  -> existing sync_events insert

same event_id + same canonical identity/payload
  -> duplicate replay, no re-execution

same event_id + different identity/payload
  -> conflict (409 / EVENT_ID_REUSED)
```

## Organization isolation

A replay is compared against the tenant organization as part of the canonical
fingerprint. Reusing an event ID across organizations with different organization
identity is therefore a conflict rather than a successful duplicate.

## Deterministic fingerprint

The fingerprint covers:

- organization ID
- event type
- aggregate type
- aggregate ID
- event payload

Object keys are recursively canonicalized before SHA-256 hashing, so equivalent
JSON objects with different key ordering remain the same event.

## Concurrency

`processSyncEvent()` now begins with `BEGIN IMMEDIATE` before the existing-event
lookup. This preserves the existing SQLite transaction boundary while preventing
two concurrent first-seen deliveries from independently passing the duplicate
check before either insert commits.

## What was not introduced

- no replay table
- no idempotency table for sync events
- no event broker
- no message bus
- no consumer registry
- no duplicate Fulfillment authority
- no duplicate Inventory authority
- no new stock mutation path
- no route implementation

## Regression

`npm run test:phase13.11.11`

Covers first-seen acceptance, exact replay, same-ID/different-payload conflict,
cross-organization conflict, deterministic key-order-independent fingerprints,
and source-level persistence/authority locks.

## Runtime

Observed environment remains Node `v22.16.0`. The project requirement remains
Node `>=24`; this phase does not change or lower it. Node 24 release certification
is therefore not claimed from this environment.
