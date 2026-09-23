# P1-IMPLEMENTATION-08 — IAM Certification & Trace Matrix

## Purpose

Consolidate the FUX-2 IAM productization work into one read-only certification trace:

`Role → Permission → Scope → Condition/Approval → UI affordance → Server enforcement → Audit/event`

This increment does not create a second authorization authority, role store, permission store, approval store, audit store, or evaluator.

## Canonical authorities

- Authorization: `backend/lib/authorization.js`
- Resource/action vocabulary: `backend/lib/resource-action-registry.js`
- Approval boundary: `backend/lib/vertical-approval-boundary.js`
- Existing membership/audit persistence: canonical membership/audit paths in `backend/lib/store-sqlite.js`
- UI: read-only productization; UI visibility is not authorization.

## Reconciliation statuses

- `EXISTING` — canonical server role exists.
- `MAP` — target Pack role maps to an existing canonical server role.
- `EXTEND` — product role requires deliberate canonical policy/enforcement extension.
- `NEW` — a distinct canonical server role would be required.
- `DEFERRED` — intentionally not executable until its canonical authority exists.

## Certification rule

Every executable role path must be traceable through:

`Role → Permission → Scope → Condition/Approval → UI affordance → Server enforcement → Audit/event`.

A product-model role does not become an authorization role merely because it is displayed in Settings.

## Open certification item

The current source has membership creation/invite role-upgrade audit paths, but no clearly established generic membership role-change endpoint/store was evidenced. Therefore P1-02 remains an explicit open trace item rather than being silently marked complete.

## Validation

Focused P1-08 regression, syntax checks, FUX-29 and FUX-30 must pass before packaging.
Node ≥24 runtime certification remains a separate release gate.
