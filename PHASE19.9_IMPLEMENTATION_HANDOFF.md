# Phase 19.9 — Opportunity Model & Action Links Implementation Handoff

## Status
IMPLEMENTED / SOURCE-VERIFIED

## Baseline
Built directly on the Phase 19.8 explainable-ranking source baseline.

## Purpose
Phase 19.9 introduces a persistence-free derived Opportunity representation:

`Demand + Candidate + Match + Evidence + Feasible Action`

An Opportunity is not a new economic entity authority. It is a deterministic projection that helps a consumer move from discovery to an action owned by the relevant domain.

## Implemented
- Added `backend/lib/discovery/opportunity-model.js`.
- Added `buildDiscoveryOpportunity()` for a single eligible ranked candidate.
- Added `buildDiscoveryOpportunities()` for ranked result collections.
- Added deterministic derived `opportunityId`; no database persistence is used.
- Preserves candidate provenance: source, sourceAuthority, sourceEntityId, organizationId.
- Preserves deterministic match score, rank, factors, and hard-constraint outcomes.
- Preserves supplied evidence without creating new evidence.
- Normalizes provider-supplied action links without executing them.
- Marks execution as owning-domain responsibility.
- Explicitly exposes `deterministic: true` and `ai: false`.
- Added `phase0/phase19.9-opportunity-model-regression.mjs`.
- Added `test:phase19.9` package script.
- Corrected the existing Phase 19.2 package script to reference the actual regression filename in the source tree.

## Opportunity Boundary

`Intent → Candidate → Match → Evidence → Opportunity → Action Link → Owning Domain`

The Discovery Fabric creates the opportunity projection but does not execute the action.

Examples of action ownership:
- Marketplace action → Commerce/Marketplace executes order/checkout.
- Request Quote action → Procurement executes RFQ workflow.
- Supplier relationship action → Supplier Network owns the relationship workflow.

## Explicit Non-Changes
- No database migration.
- No opportunity table.
- No product, seller, supplier, organization, inventory, payment, order, procurement, or trust authority.
- No transaction execution.
- No payment authorization.
- No inventory mutation.
- No procurement award.
- No AI ranking or candidate invention.
- No composite trust score.
- No replacement of Phase 18 Supplier Network authority.

## Verification
- Phase 19.9 regression: PASS
- Phase 19.8 regression: PASS
- Phase 19.7 regression: PASS
- Phase 19.6 regression: PASS
- Phase 19.5 regression: PASS
- Phase 19.4 regression: PASS
- Phase 19.3 regression: PASS
- Phase 19.2 regression: PASS
- Phase 18.12 cumulative exit: PASS
- Phase 0 Golden: 21 PASS / 0 FAIL
- Node >=24 certification: DEFERRED (observed runtime Node v22.16.0)

## Architecture Position

`Structured Intent → Provider Candidates → Canonical Market Context → Hard Constraints → Deterministic Match Factors → Match Result → Explainable Ranking → Opportunity → Action Link`

## Next Phase
Phase 19.10 — Unified Discovery API.
