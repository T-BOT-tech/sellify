# Phase 13.11.12 — Failure Isolation

**Status:** COMPLETE — 2026-09-08

## Objective

Ensure one failed event cannot partially commit domain work or abort unrelated
sibling events in the existing event batch path.

## Existing authorities retained

- Per-event transaction: `backend/lib/store-sqlite.js#processSyncEvent`
- Durable event identity: `sync_events`
- Batch transport: existing `POST /events/:chatId`
- Outbox: existing `app/src/sync/outbox.js`

## Implementation

Added `backend/lib/event-failure-isolation.js`, a persistence-neutral boundary
that converts an individual processing exception into an isolated rejected
result while preserving the event identity and optional error code/retryability.

The existing server batch handler now delegates each event through this helper.
There is deliberately no transaction around the entire batch.

`processSyncEvent()` already owns the SQLite transaction. Its `BEGIN IMMEDIATE`
/ `COMMIT` / `ROLLBACK` boundary means a domain mutation and its `sync_events`
record commit together or neither commits.

## Failure semantics

```text
Batch
 ├─ Event A → success → commit
 ├─ Event B → failure → rollback → rejected result
 └─ Event C → success → commit
```

Event B cannot leave behind a partial inventory movement or `sync_events` row,
and its failure does not prevent Event C from being attempted.

## What was not introduced

- no batch-wide transaction
- no new failure database
- no retry queue
- no dead-letter store
- no event broker
- no duplicate sync event authority
- no duplicate Inventory / Fulfillment authority
- no route or dispatch implementation

## Regression

`npm run test:phase13.11.12`

Covers isolated failures, sibling-event continuation, post-mutation rollback,
absence of a failed `sync_events` record, and source-level locks against a
shared batch transaction or duplicate failure store.

## Runtime

Observed environment: Node `v22.16.0`.

Project requirement remains Node `>=24`; no Node 24 release certification is
claimed from this environment.
