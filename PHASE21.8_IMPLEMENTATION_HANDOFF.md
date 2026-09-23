# SELLIFY Phase 21.8 — Discovery + Ranking Integration

Status: IMPLEMENTED / PASS

## Purpose

Phase 21.8 integrates Phase 21 sourcing signals with the existing Phase 19 Discovery Fabric without creating a second discovery, matching, ranking, trust, or opportunity authority.

## Authority

- Phase 19 Discovery Fabric remains discovery authority.
- Phase 19 Discovery Matching remains deterministic eligibility authority for Discovery.
- Phase 19 Explainable Ranking remains ranking authority.
- Phase 21 remains responsible only for derived sourcing projections.
- Agriculture remains Commodity authority.
- Procurement remains Demand authority.
- Supplier Network remains Supplier / Capability / Capacity authority.
- Product/Catalog remains Product authority.
- Inventory remains Inventory authority.

## Integration rule

Phase 21 may project a Sourcing Opportunity into a Discovery candidate shape only after receiving the canonical Discovery match result. Phase 21 does not calculate or replace the Discovery match score and does not assign a rank.

Flow:

Phase 21 Sourcing Opportunity
→ canonical Phase 19 Discovery Match
→ existing Phase 19 Explainable Ranking
→ existing Discovery Opportunity / read-only result

## Explicit prohibitions

- no second ranking engine
- no second discovery store
- no trust-score authority
- no persisted sourcing opportunity
- no inventory mutation
- no procurement mutation
- no order creation
- no payment execution
- no provider execution

UNKNOWN remains UNKNOWN. Discovery eligibility and Phase 21 sourcing eligibility are both required before a sourcing projection can be ranked.

## Verification

21.0: 20 PASS / 0 FAIL
21.1: 17 PASS / 0 FAIL
21.2: 13 PASS / 0 FAIL
21.3: 15 PASS / 0 FAIL
21.4: 18 PASS / 0 FAIL
21.5: 13 PASS / 0 FAIL
21.6: 17 PASS / 0 FAIL
21.7: 17 PASS / 0 FAIL
21.8: 15 PASS / 0 FAIL

Cumulative: 145 PASS / 0 FAIL

Node >=24 remains deferred to the established verification phase.
