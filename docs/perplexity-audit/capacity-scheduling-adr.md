# ADR: capacity evidence and Logistics Scheduling authority

## Status

Accepted for bounded time-bound Discovery matching. Operational Logistics Scheduling remains request-only pending a trusted feasibility authority.

## Context

Current analysis indicates that Logistics Scheduling is a request-only coordination queue.

A caller-provided `FEASIBLE` assertion cannot change an `UNKNOWN` evaluation to `FEASIBLE`, and a requested activity cannot transition to `SCHEDULED` without a trusted feasibility decision.

Separately, time-bound Discovery capacity matching now evaluates evidence freshness, validity, quality, active status, quantity, unit, and period overlap. The implementation does not make every legacy quantity-only search freshness-aware, and it does not establish independent evidence verification or operational scheduling feasibility.

## Decision

1. Treat Logistics Scheduling as **request-only** until a trusted capacity and feasibility authority exists.
2. Do not expose operational `SCHEDULED`, `CONFIRMED`, or execution actions unless the trusted evaluator authorizes them.
3. Treat supplier-entered capacity as `SELF_REPORTED` only when the Supplier Network source has a server-authored `observedAt`; legacy declarations without that timestamp remain `UNKNOWN`.
4. Do not allow suppliers to self-assert `OBSERVED` or `VERIFIED` evidence quality.
5. Store server-authored `observedAt`; do not trust supplier-provided future timestamps.
6. Treat `validUntil` as explicit and nullable; do not infer it from `periodEnd`.
7. Expired, stale, unknown, conflicting, or future-observed evidence must not satisfy a time-sensitive hard availability constraint.
8. Preserve candidates with an `UNKNOWN` or `STALE` explanation rather than presenting them as confirmed availability.
9. Keep capacity evidence separate from provider selection, RFQ award, reservation, dispatch, fulfillment, inventory movement, payment, and settlement.

## Current implementation evidence

The current implementation already enforces the bounded decision above for time-bound Discovery matching: Supplier Network authors `observedAt` at write time and persists supplier-declared `validUntil` after validating that it is not earlier than the observation time; the Discovery provider maps declarations to `SELF_REPORTED` only when an observation timestamp exists; and the canonical matcher rejects missing or invalid timestamps, future observations, expired validity, non-active status, unknown/stale/conflicting quality, non-overlapping periods, and insufficient quantity. `OBSERVED` and `VERIFIED` remain rejected without an independent observer binding. The Phase 19.7 and Phase 16.13.10 regressions exercise these boundaries. Phase 21.20 also verifies immutable, buyer-visible capacity evidence snapshots at RFQ creation.

This does not establish independent verification or operational Logistics Scheduling feasibility. It also does not imply every non-time-bound quantity search applies the same freshness requirements.

## Consequences

- The scheduling UI must disable or hide actions that cannot be authorized.
- Capacity matching must distinguish declared supply windows from evidence freshness.
- Legacy capacity records without validity remain visible but cannot satisfy time-sensitive hard constraints.
- A future operational scheduling model requires an explicit canonical resource/capacity owner and adapter contract.

## Alternatives considered

| Option | Assessment |
|---|---|
| Request-only coordination queue | Safest immediate model; avoids false operational certainty. |
| Operational scheduling now | Premature without a trusted capacity authority and adapter contract. |
| Infer validity from supply period | Rejected: conflates commercial supply window with evidence freshness. |
| Supplier self-verification | Rejected: creates an integrity and trust boundary violation. |

## Remaining exit criteria

- Independent OBSERVED or VERIFIED evidence requires a trusted observer identity, provenance contract, and authorization boundary.
- Every non-time-bound capacity consumer must be reviewed before being used for hard time-sensitive decisions.
- Scheduling cannot mutate orders, fulfillment, inventory, payments, or dispatch.
- Tenant, organization, location, and role authorization tests remain required for any scheduling execution path.
- UI exposes only states that the evaluator can authorize.
