# Phase 19.8 — Explainable Ranking Implementation Handoff

## Status
IMPLEMENTED / SOURCE-VERIFIED

## Baseline
Built directly on the Phase 19.7 deterministic matching source baseline.

## Purpose
Phase 19.8 adds a persistence-free explainability and ranking layer over already-eligible deterministic match results. It explains why a candidate ranked where it did without creating new economic truth or changing source-domain authority.

## Implemented
- Added `backend/lib/discovery/explainable-ranking.js`.
- Added `explainDiscoveryMatch()` for structured candidate explanations.
- Added `rankDiscoveryMatches()` for deterministic ordering of eligible match results.
- Preserves the Phase 19.7 `matchScore`; it does not recompute or alter match truth.
- Exposes factor dimensions, points, reasons, and hard-constraint outcomes.
- Provides deterministic rank numbers after eligibility and match evaluation.
- Preserves provenance fields: source, sourceAuthority, sourceEntityId, organizationId.
- Preserves `trustScore` as a separate field; ranking never derives trust from match score.
- Explicitly reports `deterministic: true` and `ai: false`.
- No persistence, transaction execution, or opportunity persistence.
- Exported through the Discovery Fabric index.

## Ranking Boundary
The layer follows:

`Provider Candidates → Market Context → Deterministic Matching → Eligible Matches → Explainable Ranking`

Ineligible candidates are not rescued by ranking and do not receive a ranked result.

## Explanation Boundary
Explanations are derived only from supplied deterministic match results and candidate provenance. The layer does not invent:
- inventory
- capacity
- certifications
- pricing
- trust
- supplier truth
- marketplace truth

## Explicit Non-Changes
- No database migration.
- No new product, seller, supplier, organization, inventory, payment, order, procurement, or trust authority.
- No AI ranking.
- No composite trust score.
- No opportunity persistence.
- No transaction execution.
- No replacement of Phase 18 Supplier Network discovery authority.

## Regression
`phase0/phase19.8-explainable-ranking-regression.mjs`

Coverage:
- contract invariants
- preservation of deterministic match score
- factor explanations
- hard-constraint explanations
- rank assignment
- deterministic tie-breaking
- provenance preservation
- match/trust separation
- AI boundary
- persistence/execution boundary

## Verification
- Phase 19.8 regression: PASS
- Phase 19.7 regression: PASS
- Phase 19.6 regression: PASS
- Phase 19.5 regression: PASS
- Phase 19.4 regression: PASS
- Phase 19.3 regression: PASS
- Phase 19.2 regression: PASS
- Phase 18.12 structural exit: PASS
- Phase 0 Golden: 21 PASS / 0 FAIL
- Node >=24 certification: DEFERRED (current observed runtime Node v22.16.0)

## Architecture Position
`Structured Intent → Provider Candidates → Canonical Market Context → Hard Constraints → Deterministic Match Factors → Match Result → Explainable Ranking`

Phase 19.8 is explanation/ranking infrastructure, not a new economic authority.
