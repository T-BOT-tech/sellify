# P1-IMPLEMENTATION-09 — Membership Role-Change Authority

## Scope
Closes the previously identified P1-02 gap by establishing a canonical server-side membership role-change operation using the existing memberships table and audit authority.

## Contract
- GET `/tenants/:chatId/memberships` — owner/manager read of active tenant memberships.
- POST `/auth/membership-role` — owner/manager role change for a membership in the authenticated tenant.
- Supported canonical roles: owner, manager, cashier, staff, buyer, viewer.
- UI is advisory; server authorization and membership state remain authoritative.

## Guardrails
- Authenticated tenant session required.
- Target membership must belong to the same tenant and be active.
- Actor must be owner or manager.
- Self-role changes are rejected.
- Only owner may change/assign owner.
- Manager may assign cashier, staff, or viewer.
- Last owner cannot be demoted.
- No new membership store, role evaluator, or audit store.
- Every successful change emits `membership.role_changed` through the existing audit authority.

## Validation
- P1-09 focused regression: PASS
- FUX-29: PASS
- FUX-30: PASS
- JavaScript syntax checks: PASS
- Node runtime currently 22.16.0; project Node >=24 release certification remains separate.
