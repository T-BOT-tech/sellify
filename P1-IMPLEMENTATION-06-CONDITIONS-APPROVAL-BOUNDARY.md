# P1-IMPLEMENTATION-06 — Conditions & Approval Boundaries

## Purpose

Productize the existing canonical conditions/approval boundary without creating a second approval workflow, role store, permission store, or authorization evaluator.

## Implementation

- Added `GET /tenants/:chatId/authorization/conditions-contract`.
- Endpoint is read-only and requires canonical `settings:configure` authorization.
- Exposes existing condition/enforcement contracts from:
  - `backend/lib/authorization.js`
  - `backend/lib/tenant-isolation.js`
  - `backend/lib/resource-action-registry.js`
  - `backend/lib/vertical-capability-authorization.js`
  - `backend/lib/vertical-mutation-enforcement.js`
  - `backend/lib/vertical-approval-boundary.js`
- Added Settings surface `conditionsApprovalPanel`.
- UI explicitly remains informational; it cannot grant approval or permission.
- Approval evidence remains externally supplied to the existing approval boundary.
- No approval store was created.
- No new role or permission authority was created.
- Canonical mutation execution remains behind the existing server-side enforcement gates.

## Current source truth

The current authorization policy exposes the decision vocabulary:

- `ALLOW`
- `DENY`
- `REQUIRES_APPROVAL`

The existing vertical approval boundary validates approval evidence using `status`, `approvedBy`, and `approvedAt`. The current contract explicitly identifies approval authority as an existing/future external workflow and has no local approval store.

## Validation

- P1-06 Conditions & Approval Boundary Regression: PASS
- P1-05 scope/context regression: PASS
- P1-04 Pack-role reconciliation regression: PASS
- P1-03 permission × role × scope regression: PASS
- FUX-29 seller golden journey regression: PASS
- FUX-30 multi-channel adversarial regression: PASS
- `node --check backend/server.js`: PASS
- `node --check app/src/authorization/conditions-approval.js`: PASS
- `node --check app/src/ui/settings.js`: PASS

Existing module-type warnings are non-failing. Node 24+ runtime certification remains a separate release gate.
