# SELLIFY Phase 21.3 — Capacity / Availability Evidence

## Status
IMPLEMENTED — PASS

## Authority decision
Phase 21.3 is an additive composition/evidence boundary over the existing Supplier Network capacity authority.

Canonical authority remains:
- Supplier Network → capacity declarations/signals
- Organization → supplier identity
- Product/Catalog → product identity
- Inventory → stock truth
- Procurement → procurement demand/acquisition

Phase 21 does not create a second capacity store or inventory ledger.

## Evidence vocabulary
Capacity observations may be classified as:
- SELF_REPORTED
- OBSERVED
- VERIFIED
- STALE
- UNKNOWN
- CONFLICTING

Unknown is never promoted to success.

## Boundary semantics
A capacity observation records quantity/unit plus an observation window and provenance. It remains a coordination projection and does not itself:
- reserve inventory
- create procurement demand
- create an order
- mutate inventory
- authorize payment
- execute a provider

## Verification
Phase 21.3 regression: 15 PASS / 0 FAIL.
Previous Phase 21 regressions remain green:
- Phase 21.0 baseline: 20 PASS / 0 FAIL
- Phase 21.1 boundary: 17 PASS / 0 FAIL
- Phase 21.2 capability: 13 PASS / 0 FAIL

Cumulative Phase 21 checks: 65 PASS / 0 FAIL.

Node >=24 verification remains deferred to the established runtime-verification phase; the source environment is Node 22.x.
