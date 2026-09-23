# Phase 10.7 — Outbox / Event Sync

Status: implemented additively.

## Objective
Make offline customer and inventory writes durable through a local outbox and an authenticated, idempotent server event endpoint without replacing existing order/catalog sync.

## Implemented
- local `outboxEvents` persisted through existing IndexedDB/localStorage persistence
- `enqueueEvent()` creates durable idempotency-keyed events
- inventory movement creation enqueues a canonical `inventory.movement.record` event
- customer save enqueues `customer.upsert` while retaining the existing direct API bridge
- `flushOutbox()` batches up to 100 events and removes acknowledged events
- backend migration 10 adds `sync_events` with unique `event_id`
- `POST /events/:chatId` authenticates the tenant session and processes supported events transactionally
- duplicate events are acknowledged without duplicate domain writes
- existing `/sync` order flow and catalog sync remain unchanged

## Event contract
```text
Local Transaction
→ Outbox Event
→ POST /events/:chatId
→ Idempotent Server Transaction
→ ACK
→ Remove from local outbox
```

Supported event types in this phase:
- `inventory.movement.record`
- `customer.upsert`

## Boundary
Orders/catalog are intentionally not moved to the new event channel yet. That migration requires route-by-route reconciliation with the existing sync contract.

## Validation
- Phase 10.7 Outbox/Event Regression: PASS
- Phase 10.6 Multi-Location Regression: PASS
- Phase 10.5 Inventory Ledger Regression: PASS
- Phase 10.3 Authorization Regression: PASS
- Phase 0 Golden Regression: PASS
- JavaScript syntax checks: PASS

## Compliance checkpoint

The outbox/event-sync implementation is complete for this checkpoint.
Compliance / Audit hardening is implemented additively in
`phase10.7-COMPLIANCE-AUDIT.md`; the event channel remains unchanged.
