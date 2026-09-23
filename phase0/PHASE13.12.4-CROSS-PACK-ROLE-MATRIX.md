# Phase 13.12.4 — Cross-Pack Role Matrix

**Status:** COMPLETE — 2026-09-08  
**Scope:** Map the existing Phase 10.3 roles to the Phase 13.12.3 vertical resource/action vocabulary without creating a second RBAC or authorization system.

## Objective

Produce one auditable cross-pack matrix showing, for every existing Core role and registered vertical capability, whether the current central policy permits the capability.

The matrix is derived evidence, not a new policy authority.

```text
Existing role / membership
        ↓
Phase 13.12.3 resource/action registry
        ↓
Existing Phase 10.3 permission policy
        ↓
ALLOW / DENY
        ↓
Canonical capability
```

## Existing roles preserved

The matrix uses only the existing Phase 10.3 roles:

- owner
- manager
- cashier
- staff
- buyer
- viewer

No role was added, renamed, split, or promoted.

## Current policy result

| Pack | Current central permission surface | Effective roles under current policy |
|---|---|---|
| Agriculture | `agriculture:view`, `agriculture:manage` are registered metadata only | `owner` is `ALLOW` through the existing `*` wildcard; all other roles remain `DENY` |
| Restaurant | `tables:status`, `tables:manage`, `kitchen:manage` | `owner`, `manager`, `cashier` according to existing permissions; `staff`, `buyer`, `viewer` remain `DENY` |
| Restaurant | Recipe / Preparation have no central permission | all roles `DENY` |
| Warehouse | `inventory:view`, `inventory:add`, `inventory:edit` | `owner`, `manager`, `cashier`, `staff` according to existing permissions; `buyer`, `viewer` remain `DENY` |
| Logistics | no named central Logistics-specific permission exists | `owner` is `ALLOW` through the existing `*` wildcard; all other roles remain `DENY` |

**Important:** Agriculture and Logistics are not granted named permissions by this phase. The existing Phase 10.3 `owner` wildcard (`*`) already authorizes arbitrary non-empty action keys, so the matrix records that existing behavior rather than falsely reporting `DENY`. No non-owner role is broadened.

## Scope rules

All matrix rows require a valid organization scope. The existing authorization path continues to reject organization mismatch.

Location scope is **validated when supplied** by the existing authorization/tenant-isolation boundary. This phase does not invent a new location policy or force every capability to become location-scoped.

## Approval boundary

The current Phase 10.3 policy contains no new `REQUIRES_APPROVAL` rule for the registered Phase 13 vertical vocabulary. The matrix therefore records only the current effective `ALLOW` / `DENY` state, including the pre-existing owner wildcard.

## Matrix implementation

Added:

- `backend/lib/cross-pack-role-matrix.js`
- `phase0/phase13.12.4-cross-pack-role-matrix-regression.mjs`
- `phase0/PHASE13.12.4-CROSS-PACK-ROLE-MATRIX.md`
- `phase0/PHASE13.12.4-SOURCE-HASHES.sha256`
- `test:phase13.12.4`
- updated `SELLIFY_AI_HANDOFF.md`

The implementation derives 6 existing roles × 42 registered resource/actions = **252 matrix rows**.

It has no database access, no permission persistence, no role store, and no authorization evaluator.

## Security invariants

1. Phase 10.3 `backend/lib/authorization.js` remains the sole authorization authority.
2. The matrix cannot grant access by itself.
3. Vocabulary-only registry entries remain `DENY` until a deliberate central policy change exists.
4. Existing role permissions are not broadened.
5. Organization mismatch remains denied by the existing authority.
6. Location mismatch remains denied by the existing authority when a location is supplied.
7. No vertical pack receives its own RBAC, role, permission, tenant, or audit authority.
8. Phase 13.13 configuration is not pulled forward.
9. Phase 13.14 event/outbox implementation is not pulled forward.

## Exit criteria

Phase 13.12.4 passes when:

- all six existing roles are represented;
- all 42 Phase 13.12.3 registry entries are represented for every role;
- current central permission grants are preserved exactly;
- vocabulary-only capabilities do not broaden non-owner access and preserve the existing owner wildcard;
- organization/location boundary behavior remains delegated to the existing authority;
- no new authorization persistence/evaluator exists;
- Phase 13.12.0 → 13.12.3 regressions and Phase 0 golden regression remain green.

## Result

**Phase 13.12.4: PASS**

Next controlled subphase:

**Phase 13.12.5 — Organization Isolation Gate**
