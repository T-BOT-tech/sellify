# SELLIFY Phase 22.7 — Action Proposal & Authorization Boundary

Status: IMPLEMENTED / PASS

## Purpose
Phase 22.7 introduces a derived procurement action-proposal contract. It allows Phase 22 to describe an intended action while preserving existing authorization and Procurement transaction authorities.

## Canonical flow
Human → AI → Structured Procurement Intent → Procurement Context → Action Proposal → Existing Authorization → Existing Procurement Authority

## Authority rules
- Phase 22 owns no procurement transaction state.
- Phase 22 does not authorize actions.
- Phase 22 does not execute actions.
- Existing `backend/lib/authorization.js` remains the authorization authority.
- Existing Procurement capability/domain services remain transaction authorities.
- Purchase-order execution is not a Phase 22 proposal target.
- No database, credential, ledger, provider, payment, inventory, order, award, or PO mutation is introduced.

## Proposal semantics
A proposal is request-scoped and derived. `pending_authorization` means the proposal is ready to be evaluated by the existing authorization boundary; it does not mean authorized.

## Invariants
`INTENT ≠ FEASIBILITY ≠ AUTHORIZATION ≠ EXECUTION`

`UNKNOWN ≠ SUCCESS`

`PROPOSAL ≠ TRANSACTION`

## Verification
Phase 22.7 regression: 10 PASS / 0 FAIL.

Node runtime observed during implementation: Node v22.16.0. Node >=24 certification remains a later gate and is not claimed here.
