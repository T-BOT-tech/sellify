# Phase 10.7 — Compliance / Audit Hardening

Status: implemented additively.

## Objective

Harden the existing `audit_events` infrastructure into the canonical
compliance boundary without replacing the existing audit table or event
sync.

## Implemented

- Preserved existing `audit_events` records and action/entity contract.
- Added canonical audit context:
  - `actor_id`
  - `organization_id`
  - `location_id`
  - `device_id`
  - `reason`
  - `result`
- Existing audit writes now infer `organization_id` from the tenant when
  context is not explicitly supplied, preserving legacy call sites.
- Added indexes for organization, actor, and resource history.
- Added SQLite append-only protections for audit updates/deletes.
- Added organization audit-retention policy metadata with a bounded
  retention window (30–3650 days).
- Added compliance request workflow:
  - `ACCESS`
  - `EXPORT`
  - `DELETION`
  - `pending → approved/rejected/completed/cancelled`
- Added organization/customer compliance export capability.
- Added audit access/export events.
- Extended the existing audit endpoint with action/actor/resource filters.
- Added `compliance:manage` to the existing manager permission set; owner
  remains unrestricted through the existing wildcard policy.
- Added executable Phase 10.7 compliance regression coverage.
- Updated Phase 0 migration expectations from 1–10 to 1–11.

## Compatibility

No existing order/catalog sync was replaced.

The Phase 10.7 outbox/event channel remains:

```text
Local Transaction
→ Outbox Event
→ POST /events/:chatId
→ Idempotent Server Transaction
→ ACK
```

Orders and catalog remain on their existing sync routes.

## API additions

```text
GET   /tenants/:chatId/compliance/retention
PATCH /tenants/:chatId/compliance/retention

GET   /tenants/:chatId/compliance/requests
POST  /tenants/:chatId/compliance/requests
PATCH /tenants/:chatId/compliance/requests

GET   /tenants/:chatId/compliance/export/:subjectType
GET   /tenants/:chatId/compliance/export/:subjectType/:subjectId
```

Existing:

```text
GET /tenants/:chatId/audit
```

now supports:

```text
?limit=
?action=
?actor_id=
?entity_type=
```

and records an `audit.accessed` event.

## Important boundary

Audit events are immutable at the database level. Retention is therefore
represented as an explicit organization policy; this phase does not silently
delete audit history. A future controlled archival/purge mechanism must
preserve the compliance trail before physical deletion.

Deletion requests are workflow records and do not perform destructive
customer deletion automatically.

## Validation

- Phase 0 Golden Regression: PASS
- Phase 10.7 Compliance/Audit Regression: PASS
- Phase 10.7 Outbox/Event Regression: PASS
- Phase 10.6 Multi-Location Regression: PASS
- Phase 10.5 Inventory Ledger Regression: PASS
- Phase 10.3 Authorization Regression: PASS
- JavaScript syntax checks: PASS

## Migration

Schema migration `11` is forward-only and repeat-safe.

Historical migrations remain unchanged.

## Incremental hardening after initial implementation

The first Phase 10.7 implementation has been hardened without changing its external architecture.

### Compliance request lifecycle

Requests now validate their subject boundary:

```text
organization → current organization only
customer     → existing customer in current organization
```

State transitions are explicit:

```text
pending   → approved | rejected | cancelled
approved  → completed | cancelled
rejected  → terminal
completed → terminal
cancelled → terminal
```

Invalid transitions return a conflict and are not persisted.

### Compliance exports

Organization exports now include bounded audit history, the organization's retention policy, and compliance-request history. Customer exports include bounded audit history scoped to that customer. The existing export version remains unchanged for compatibility.

### Compatibility boundary

No second audit table, permission system, event channel, or deletion engine was introduced. Existing audit immutability, authorization, outbox/event sync, order/catalog sync, and legacy tenant behavior remain intact.
