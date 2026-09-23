# Phase 13.12.10 — Sensitive-Action Audit Gate

## Purpose

Phase 13.12.10 proves that sensitive vertical actions produce canonical audit
records without turning audit into an authorization authority.

## Boundary

```text
Authorization / Approval / Mutation outcome
              ↓
      Sensitive-Action Audit Gate
              ↓
      Existing Audit Boundary
              ↓
      existing audit_events / recordAuditEvent()
```

## Sensitive-action scope

For the current Phase 13 vertical resource/action registry, `manage` actions
are mutation-capable and therefore sensitive. `view` actions are not promoted
to this mutation audit gate.

## Required evidence

A sensitive record carries canonical tenant and actor context plus:

- vertical pack/resource/action
- authorization decision
- outcome: success/failure/denied/rejected
- entity identity when available
- reason
- correlation/causation/event identifiers when supplied
- occurrence timestamp

## Authority preservation

- Authorization remains `backend/lib/authorization.js`.
- Vocabulary remains `backend/lib/resource-action-registry.js`.
- Audit normalization remains `app/src/audit/audit-boundary.js`.
- Persistence remains the existing `recordAuditEvent()` / `audit_events` authority.
- This phase adds no audit store, event store, telemetry backend, logger authority,
  approval store, permission evaluator, or configuration authority.

## Failure rule

The audit adapter is persistence-neutral. It does not silently replace or
bypass the existing audit persistence capability. Callers must provide the
existing canonical persistence function.

## Deferred boundaries

Events/outbox remain Phase 13.14. Configuration remains Phase 13.13. No new
approval or authorization authority is introduced here.
