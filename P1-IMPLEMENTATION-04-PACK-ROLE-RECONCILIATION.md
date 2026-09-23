# SELLIFY P1-IMPLEMENTATION-04 — Pack-role reconciliation

Date: 2026-09-19

## Scope

Productize FUX-2 Section 6 reconciliation without creating a second IAM authority.

## Implemented

- Added `app/src/authorization/role-reconciliation.js` as a read-only reconciliation register.
- Added the reconciliation table to the existing Settings → Roles & Access surface.
- Preserved the six canonical server roles: `owner`, `manager`, `cashier`, `staff`, `buyer`, `viewer`.
- Preserved the Section 6 target Pack-role families as product-model metadata.
- Reconciliation statuses are `EXISTING / MAP / EXTEND / NEW / DEFERRED`.
- `MAP` means an explicit product-role mapping to an existing canonical role; it does not create a new server role.
- `EXTEND` and `NEW` remain non-assignable until deliberate central authorization work establishes permissions, scope, conditions, UI affordance, server enforcement, and audit behavior.
- No new persistence, evaluator, permission store, or policy mutation was introduced.

## Authority

Canonical authorization remains `backend/lib/authorization.js`.

## Validation

- `node phase0/p1-04-pack-role-reconciliation-regression.mjs` — PASS
- `node --check app/src/authorization/role-reconciliation.js` — PASS
- `node --check app/src/authorization/role-catalog.js` — PASS
- `node phase0/fux29-seller-golden-journey-regression.mjs` — PASS
- `node phase0/fux30-multi-channel-adversarial-regression.mjs` — PASS

The FUX regressions emit the existing Node module-type warnings but pass. Node 24 release certification remains a separate gate.
