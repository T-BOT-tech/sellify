# Phase 13.12.9 — Approval Boundary

## Purpose

Phase 13.12.9 proves that a vertical mutation cannot execute when the canonical
authorization decision is `REQUIRES_APPROVAL` unless valid approval evidence is
supplied by the existing/future approval workflow.

This phase does **not** create a second authorization authority or an approval
persistence/workflow authority.

## Boundary

```text
Canonical Authorization
        ↓
ALLOW ─────────────────────→ Mutation Gate → Canonical Mutation
        ↓
REQUIRES_APPROVAL
        ↓
Existing/Future Approval Evidence
        ├── missing/invalid → STOP
        └── valid APPROVED → Mutation Gate → Canonical Mutation
```

## Approval evidence

The gate accepts persistence-neutral evidence containing:

- `status: APPROVED`
- `approvedBy`
- `approvedAt`

The gate does not store, discover, persist, or independently authorize the
approval. It only enforces the boundary before mutation execution.

## Authority preservation

- Authorization: `backend/lib/authorization.js`
- Vertical capability authorization: `backend/lib/vertical-capability-authorization.js`
- Mutation execution: `backend/lib/vertical-mutation-enforcement.js`
- Approval workflow/storage: external existing or future canonical workflow
- Audit: deferred to Phase 13.12.10
- Events/outbox: deferred to Phase 13.14
- Configuration: deferred to Phase 13.13

## Important current-state constraint

Phase 10.3 currently exposes `ALLOW | DENY | REQUIRES_APPROVAL`, while the
current policy matrix returns `ALLOW` or `DENY` for the policies presently
registered. This phase therefore certifies the `REQUIRES_APPROVAL` branch
without inventing a new policy that would force an approval requirement.
