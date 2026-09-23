# Phase 13.12.12 — Cross-Pack Escalation Tests

## Purpose

Attack the composed Phase 13 authorization boundary across Agriculture, Restaurant,
Warehouse, and Logistics. Prove that permission granted for a capability in one
vertical pack cannot be converted into authority for an unrelated capability in
another pack.

## Security chain under test

`Actor/session → tenant/location isolation → pack-scoped capability registry → central Phase 10.3 permission policy → decision`

For mutations the existing Phase 13.12.8/13.12.9/13.12.10 gates remain the
execution/audit boundaries; this phase does not replace them.

## Attack classes

1. Cross-pack resource substitution
2. Cross-pack action substitution
3. Pack-id substitution with a valid capability from another pack
4. Central permission confusion between Agriculture / Restaurant / Warehouse
5. Logistics policy-neutral capability escalation
6. Owner wildcard containment for vocabulary-only Logistics actions
7. Cross-pack escalation under manager/cashier/staff/buyer/viewer roles
8. Same-pack valid authorization remains unchanged
9. Tenant and location isolation remain prerequisites
10. No second cross-pack authorization authority

## Required invariant

A capability is authorized only when its own `(packId, resource, action)` registry
entry resolves and its declared central permission is authorized by the existing
Phase 10.3 `authorize()` authority. A permission from one pack is never treated as
a wildcard for another pack's resource.

Policy-neutral entries (`permission: null`) remain DENY, including for `owner`, so
cross-pack tests cannot accidentally turn vocabulary into policy.

## Scope boundary

This is a regression/attack gate only. It introduces no pack-to-pack ACL, role
store, permission store, API gateway, event store, audit store, configuration
store, or new authorization evaluator.

## Exit criteria

- Cross-pack substitutions cannot broaden authority.
- A central permission is evaluated only through the existing Phase 10.3 policy.
- Logistics vocabulary remains fail-closed.
- Owner wildcard does not convert policy-neutral capabilities into grants.
- Same-pack positive authorization remains intact.
- Tenant/location isolation remains intact.
- Phase 13.12.0–13.12.11 cumulative security chain remains green.
- Source hashes and clean ZIP extraction verify.
