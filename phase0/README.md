# Phase 0 — Regression and Historical Evidence Index

> **Historical baseline notice — reviewed 2026-11-21.** This directory is no longer merely the original Phase 6 source-baseline control layer. It now contains the executable regression suite plus Phase 0–22 implementation records, cumulative gates, source snapshots, checksums, and historical evidence. The result below (17 PASS / 0 FAIL under Node 22.16.0) is the original baseline run, **not a current full-suite result or a Node 24 release certification**. Always verify the exact current-main commit, runtime, workflow run, and test command before relying on a result.

## Executable regression suite

Run the currently registered baseline suite with:

```bash
npm run phase0:test
```

The suite creates an isolated temporary SQLite data directory, starts the real backend, exercises the HTTP surface, verifies persistence/authorization/catalog/order/marketplace/audit behavior, validates a SQLite backup, and restarts the service against the same database to verify migration idempotency.

The suite does **not** modify the project's normal `backend/data` directory.

## Original baseline result (historical)

The original extracted-baseline execution recorded:

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

This is retained as provenance only. It does not establish the current regression count or current release readiness.

## Runtime and release gates

The project declares Node `>=24`. The original baseline evidence used Node 22.16.0 with experimental `node:sqlite`; that result is not a substitute for Node 24 verification.

Run `npm run phase0:release-check` under the supported Node 24+ runtime. The command runs the baseline syntax gate and golden regression suite, then writes `phase0/RELEASE-MANIFEST.md` and its checksum. Generated release evidence must be tied to the exact source commit and runtime.

The golden suite includes an isolated backup/restore integrity drill and a second-process migration idempotency check. This is not a substitute for a production restore rehearsal; that remains a deployment gate.

## Navigating this directory

- `BASELINE.md`, `REGRESSION-SPEC.md`, and the golden regression script describe baseline behavior and executable checks.
- `PHASE10`–`PHASE12` records cover platform foundations, money/payment, B2B, marketplace, and physical commerce.
- `PHASE13` records cover vertical packs, Logistics, Warehouse, cross-pack integration, and authorization/security gates.
- `PHASE14`–`PHASE16` records cover country packs, platform capabilities, adapters, and integration contracts.
- `PHASE17`–`PHASE22` records cover Procurement, Supplier Network, capacity evidence, and AI Procurement.
- `R1`/ `R2` dated productization packages and their `SHA256SUMS` files preserve September 2026 source/evidence snapshots.

These records are an audit trail, not a current implementation queue. For current status, start with [the documentation index](../docs/README.md) and [the implementation register](../docs/SELLIFY_IMPLEMENTATION_REGISTER.md). Before reviving any task, verify it against current `main`, actual source, tests, and CI.
