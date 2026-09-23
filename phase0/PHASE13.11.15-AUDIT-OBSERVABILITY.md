# Phase 13.11.15 — Audit / Observability

## Objective

Harden the cross-pack audit and observability boundary without creating a second audit store, telemetry backend, event store, or logging authority.

## Existing authorities inspected

- `backend/lib/store-sqlite.js#audit`
- `backend/lib/store-sqlite.js#recordAuditEvent`
- `audit_events` schema and append-only triggers
- Phase 10.7 compliance/audit hardening
- Phase 13.11.10 versioned event boundary
- Phase 13.11.11 replay/idempotency boundary
- Phase 13.11.12 failure isolation
- Phase 13.11.14 tenant isolation

## Implementation

Added `app/src/audit/audit-boundary.js` as a persistence-neutral normalization and handoff contract.

The contract carries:

- organization identity
- tenant/chat identity
- location identity
- actor identity
- device identity
- action/entity identity
- reason/result
- correlation and causation identity
- event identity
- metadata and occurrence time

Persistence is delegated to the existing `recordAuditEvent()` capability. No database statements, schema creation, telemetry client, logger replacement, event broker, or second audit table were added.

## Authority rules

- `audit_events` remains the compliance/audit history authority.
- Existing append-only triggers remain authoritative for immutability.
- `organization_id` is required at the canonical boundary.
- Event correlation is metadata continuity, not a replacement event store.
- Runtime logs remain operational diagnostics; they are not promoted to compliance history.
- No duplicate audit store is permitted.
- No new telemetry backend is introduced.

## Regression

`phase0/phase13.11.15-audit-observability-regression.mjs` verifies the canonical envelope, tenant context, correlation/causation/event continuity, existing append-only storage authority, and source-level prohibitions against duplicate persistence/telemetry.
