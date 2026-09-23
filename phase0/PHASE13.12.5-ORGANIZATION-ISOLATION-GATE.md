# Phase 13.12.5 — Organization Isolation Gate

**Status:** COMPLETE — 2026-09-08
**Scope:** Prove that every Phase 13 vertical-pack security capability remains isolated to the authenticated organization using the existing tenant-isolation and Phase 10.3 authorization authorities.

## Objective

This gate certifies the organization boundary before Phase 13.12.6 location-scope enforcement. It does not create another tenant, organization, membership, RBAC, or authorization authority.

```text
Authenticated session
        ↓
existing tenant/chat + organization boundary
        ↓
existing Phase 10.3 authorize()
        ↓
ALLOW only for the actor's organization
        ↓
Phase 13 canonical capability
```

## Existing authorities preserved

- `backend/lib/tenant-isolation.js` — canonical tenant / organization boundary helpers
- `backend/lib/authorization.js` — canonical authorization evaluator
- `backend/server.js` — existing request boundary calls `assertTenantScope()` before authorization and `assertLocationScope()` when a location is supplied
- existing sessions / memberships / devices remain the identity authority

No new persistence, tenant registry, organization store, role store, or authorization evaluator was added.

## Gate coverage

The regression exercises all **42 Phase 13.12.3 resource/action entries** against representative sessions and tenant objects for:

1. same-organization access;
2. mismatched-organization access;
3. missing organization on the session;
4. missing organization on the tenant;
5. tenant `chatId` mismatch;
6. location object belonging to another organization;
7. direct Phase 10.3 authorization with an organization mismatch.

The matrix is evaluated for the existing six Phase 10.3 roles without changing their permissions.

## Security rule

An organization mismatch is always denied before a vertical capability can be considered authorized.

This gate records the existing behavior. It does not add vertical-specific tenant logic.

## Deliberately deferred

- Phase 13.12.6 location scope gate
- Phase 13.12.7 vertical capability authorization
- Phase 13.12.8 mutation enforcement
- Phase 13.12.9 approval boundary
- Phase 13.12.10 sensitive-action audit gate
- Phase 13.13 configuration
- Phase 13.14 events/outbox

## Exit criteria

Phase 13.12.5 passes when:

- all 42 registered vertical capabilities are covered;
- all six existing roles remain unchanged;
- same-organization requests preserve existing policy results;
- cross-organization requests are denied;
- missing or malformed tenant organization identity is denied;
- chat/tenant mismatch remains denied;
- cross-organization locations are denied;
- Phase 10.3 remains the sole authorization evaluator;
- no duplicate tenant/organization authority is introduced;
- Phase 13.12.0 → 13.12.4 regressions and Phase 0 golden regression remain green.

## Result

**Phase 13.12.5: PASS**

Next controlled subphase:

**13.12.6 — Location Scope Gate**
