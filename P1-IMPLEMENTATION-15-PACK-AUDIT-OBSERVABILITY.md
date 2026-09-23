# P1-IMPLEMENTATION-15 — Pack Audit & Observability UX

## Scope

Productize Pack-related audit evidence using the existing canonical Core audit authority.

## Authority boundary

- Audit persistence remains `backend/lib/store-sqlite.js` / `audit_events`.
- Audit retrieval remains `GET /tenants/:chatId/audit`.
- Authorization remains `backend/lib/authorization.js` and the existing `audit:view` permission.
- The UI is read-only and does not create Pack lifecycle events.
- No second audit store, event store, observability store, entitlement authority, or authorization evaluator is introduced.

## UX states

- `UNKNOWN`: no authenticated session or offline; audit evidence cannot be confirmed.
- `PERMISSION_DENIED`: current actor lacks `audit:view`.
- `PROVIDER_UNAVAILABLE`: canonical audit authority cannot be read.
- `SUCCESS`: canonical audit read succeeded.

Pack-related records are identified only from the returned canonical audit stream. If no Pack lifecycle events exist, the UI explicitly says that no such events are currently evidenced rather than inventing them.

## Evidence shown

Time, action, entity type, result, location, reason, and the existence of the canonical audit stream. This is contextual evidence and never grants Pack entitlement or authorization.

## Validation

- P1-15 focused regression: PASS
- FUX-29: PASS
- FUX-30: PASS
- JavaScript syntax checks: PASS
- Node 24 runtime certification: deferred; current environment is Node 22.16.0.
