# ADR: capacity evidence and Logistics Scheduling authority

## Status

Proposed

## Context

Current analysis indicates that Logistics Scheduling is a request-only coordination queue.

A caller-provided `FEASIBLE` assertion cannot change an `UNKNOWN` evaluation to `FEASIBLE`, and a requested activity cannot transition to `SCHEDULED` without a trusted feasibility decision.

Separately, supplier capacity matching currently evaluates declared quantity, unit, active status, availability, and period overlap, but does not consistently evaluate evidence freshness, validity, or quality.

## Decision

1. Treat Logistics Scheduling as **request-only** until a trusted capacity and feasibility authority exists.
2. Do not expose operational `SCHEDULED`, `CONFIRMED`, or execution actions unless the trusted evaluator authorizes them.
3. Treat supplier-entered capacity as `SELF_REPORTED` by default.
4. Do not allow suppliers to self-assert `OBSERVED` or `VERIFIED` evidence quality.
5. Store server-authored `observedAt`; do not trust supplier-provided future timestamps.
6. Treat `validUntil` as explicit and nullable; do not infer it from `periodEnd`.
7. Expired, stale, unknown, conflicting, or future-observed evidence must not satisfy a time-sensitive hard availability constraint.
8. Preserve candidates with an `UNKNOWN` or `STALE` explanation rather than presenting them as confirmed availability.
9. Keep capacity evidence separate from provider selection, RFQ award, reservation, dispatch, fulfillment, inventory movement, payment, and settlement.

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

## Exit criteria

- Capacity evidence freshness and quality flow from source to matching to UI.
- Expired, unknown, conflicting, and future-observed evidence cannot appear as fresh availability.
- Scheduling cannot mutate orders, fulfillment, inventory, payments, or dispatch.
- Tenant, organization, location, and role authorization tests pass.
- UI exposes only states that the evaluator can authorize.
