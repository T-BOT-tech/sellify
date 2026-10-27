# Outbox fallback without Web Locks and IndexedDB

## Mitigation

When IndexedDB is unavailable and the browser has no cross-tab Web Locks, outbox changes are recorded as append-only localStorage operations instead of replacing a shared read/merge/write recovery snapshot. Each mutation gets a distinct key under `sellify.outbox.recovery.log.v1:` and records a writer ID, sequence, counter, event ID, and put or delete operation. Deletes are tombstones. Replay deterministically resolves competing mutations for the same event; it is not a causal-order guarantee. Event IDs must remain immutable identities.

On startup, the fallback operations are replayed over the local snapshot and recovery journal. When IndexedDB is available again, the operations are included in an atomic outbox/marker transaction and their exact keys are removed only after that transaction succeeds. If an append-log write fails, the legacy single-key snapshot remains a best-effort fallback; it is not cross-tab atomic. If both storage writes fail, the browser cannot provide a durability guarantee, and the enqueue API does not synchronously report completion of its asynchronous persistence attempt.

## Verification on the current PR #97 base

All checks ran on Node `v24.22.1` against the isolated follow-on branch based on the current PR #97 head:

- `npx --yes node@24 phase0/outbox-localstorage-fallback-race-regression.mjs` — PASS. Covers the lost-update characterization, independent append writers, tombstones versus stale puts, deterministic same-event conflict ordering, and malformed records.
- `npx --yes node@24 phase0/offline-outbox-recovery-journal-regression.mjs` — PASS.
- `npx --yes node@24 phase0/phase10.7-outbox-regression.mjs` — PASS.
- `node --check` on `outbox-recovery-journal.js`, `outbox.js`, and `hydrate.js` — PASS.
- In Chromium `154.0.8037.57`, two real tabs called the production `enqueueEvent()` with Web Locks disabled and IndexedDB forced unavailable. Each wrote a separate append record; replay from a third page recovered both events. No page errors.
- Full Sellify hydration with IndexedDB disabled recovered both pending events from the append log, with no page errors.
- Full hydration with IndexedDB available migrated both events into `ledger_outbox_events` and removed the append-log keys only after the IDB checkpoint succeeded; no page errors.
- A separate two-tab helper test verified independent operation replay and a tombstone defeating an older/stale put.

## Remaining limits

- A long localStorage-only session can accumulate records. The implementation retains uncheckpointed records rather than compacting away pending intent; storage exhaustion can therefore make a write fail.
- Simultaneous edits to the same event use deterministic revision ordering, not a causal merge. Server acknowledgements and tenant-specific idempotency remain authoritative.
- A tab can temporarily retain a stale in-memory queue after another tab removes an event. This change guarantees append-log replay, not immediate cross-tab UI broadcast.
- Chromium browser regression `phase0/offline-outbox-browser-runtime.mjs` now fault-injects an `IDBObjectStore.put()` failure during append-log-to-IDB migration. It asserts that the append-log keys survive the aborted checkpoint, that a retry persists the pending event to `ledger_outbox_events`, and that log keys are removed only after the retry commits.
