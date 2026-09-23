# Phase 0 — Baseline Lock

This directory is the engineering control layer for the Phase 6 source baseline.

## Executable regression suite

Run:

```bash
npm run phase0:test
```

The suite creates an isolated temporary SQLite data directory, starts the real backend, exercises the HTTP surface, verifies persistence/authorization/catalog/order/marketplace/audit behavior, validates a SQLite backup, and restarts the service against the same database to verify migration idempotency.

The suite does **not** modify the project's normal `backend/data` directory.

## Current result

The suite was executed successfully against the extracted baseline:

- **17 PASS / 0 FAIL**
- health
- static serving
- generated runtime config
- tenant authentication boundary
- cross-tenant authorization boundary
- catalog create/read
- optimistic stock revision conflict
- server-side order total recomputation
- order sync idempotency
- marketplace listing visibility
- atomic marketplace stock decrement
- marketplace stock-overrun rollback behavior
- seller marketplace-order delivery queue
- audit trail
- backup protection + SQLite backup integrity
- migration idempotency after process restart

## Runtime note

The project declares Node `>=24`. The verification environment used for this baseline currently exposes `node:sqlite` on Node 22.16.0 as an experimental feature. The regression suite passing there is useful behavioral evidence, but it is **not** a substitute for the required Node 24 runtime verification.


## Phase 0.3 release control

Run `npm run phase0:release-check` under the supported Node 24+ runtime. The command runs the baseline syntax gate and golden regression suite, then writes `phase0/RELEASE-MANIFEST.md` and its checksum.

The golden suite includes an isolated backup/restore integrity drill and a second-process migration idempotency check. This is not a substitute for a production restore rehearsal; that remains a deployment gate.
