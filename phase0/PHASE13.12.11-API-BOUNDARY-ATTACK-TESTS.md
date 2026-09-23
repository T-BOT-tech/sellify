# Phase 13.12.11 — API Boundary Attack Tests

## Purpose

Attack the composed Phase 13 security boundary from the API/capability edge without creating a second authorization system.

## Security chain under test

`HTTP route → authenticated session → tenant/location isolation → canonical Phase 10.3 authorization → vertical capability registry → mutation/approval boundary → sensitive-action audit boundary → canonical capability`

## Attack classes

1. Missing/invalid session
2. Cross-organization tenant substitution
3. Foreign-organization location substitution
4. Role escalation / forged role strings
5. Forged permission names or wildcard injection
6. Unknown vertical capability
7. Policy-neutral vertical capability bypass
8. Mutation callback execution after DENY
9. Approval evidence presented without canonical authorization
10. Forged approval status / incomplete approval evidence
11. Sensitive audit boundary bypass
12. Direct vertical persistence / authority bypass
13. API mutating-route protection inventory
14. Security architecture duplicate-authority scan

## Important boundary

This phase is a regression/attack gate. It does not create a new API gateway, authorization evaluator, session store, role store, approval store, audit store, event store, or configuration store.

Existing API routes remain authoritative. The test proves that mutating routes continue to require the existing tenant/session/authorization chain and that the Phase 13 vertical enforcement adapters cannot be bypassed by forged inputs.

## Known architecture constraint

Phase 10.3 currently does not produce `REQUIRES_APPROVAL` from its role policy; the approval path remains an explicit future-compatible boundary. Tests therefore verify that forged approval evidence cannot manufacture authorization and that the existing B2B approval routes remain untouched.

## Exit criteria

- All attack cases pass.
- No mutation callback runs after an unauthorized decision.
- Cross-tenant and foreign-location attempts are denied.
- Forged role/permission/capability inputs do not broaden authority.
- Approval evidence never bypasses canonical authorization.
- No duplicate security authority is introduced.
- Phase 13.12.0–13.12.10 cumulative chain remains green.
- Source hashes and clean ZIP extraction verify.
