# Phase 19.11 — AI Intent Translation Boundary Implementation Handoff

## Status
IMPLEMENTED / SOURCE-DERIVED

## Purpose
Introduce AI only at the natural-language interpretation boundary. AI translates a user's natural-language demand into the existing canonical Discovery Market Context. Candidate discovery, eligibility, matching, ranking, provenance, trust evidence, action authorization, and execution remain outside the AI boundary.

## Frozen Flow
Natural Language → AI Translator → Structured Intent → Deterministic Discovery

## Implementation
- `backend/lib/discovery/ai-intent-translation.js`
- exported through `backend/lib/discovery/index.js`
- regression: `phase0/phase19.11-ai-intent-translation-boundary-regression.mjs`
- package script: `test:phase19.11`

## Translator Boundary
The translator is an injected adapter. No model provider, credential store, AI ranking system, or direct AI execution authority is introduced by Phase 19.11.

## Allowed AI Output
Only fields already defined by the canonical Phase 19.6 Discovery Market Context are accepted. The canonical context normalizer remains authoritative for country, currency, quantity, commercial mode, and related validation.

## Forbidden AI Output
AI cannot provide candidates, match scores, rankings, trust scores, evidence, provenance, actions, execution commands, transaction handles, provider credentials, database queries, persistence directives, authorization grants, or supplier/product/organization identity authority.

## Deterministic Handoff
`discoverFromNaturalLanguage()` performs translation first, then passes only the validated structured intent into the existing `discoverUnified()` pipeline. The resulting discovery remains deterministic even though the preceding translation stage was AI-derived.

## No Migration
No database migration or new economic entity is introduced.

## Authority Preservation
- Product: existing Product/Marketplace authorities
- Organization: Organizations
- Supplier: Procurement/Supplier Network
- Matching: Discovery Matching
- Ranking: Explainable Discovery Ranking
- Trust: source-domain evidence
- Execution: owning domain
- AI: interpretation only

## Verification
Phase 19.11 regression must pass before cumulative Phase 19 exit.
Node >=24 remains deferred to the existing Phase 16.13 certification boundary.
