# Phase 21.18 — Current Capacity Evidence Quality Verification

**Purpose:** introduce a current verification record for the Phase 21 capacity-quality correction without rewriting the frozen Phase 21.16 source snapshot.

## Defect corrected

Supplier Network capacity is a declaration. The current source authority does not independently observe or verify supplier performance. A declared signal must therefore remain **SELF_REPORTED**, regardless of a caller-supplied `OBSERVED`, `VERIFIED`, `STALE`, `UNKNOWN`, or `CONFLICTING` label.

For time-bound hard availability matching, Discovery now accepts only explicit `SELF_REPORTED`, `OBSERVED`, or `VERIFIED` evidence quality when all other existing temporal, status, subject, quantity, unit, and period constraints pass. `UNKNOWN`, `STALE`, `CONFLICTING`, and missing quality fail closed.

## Authority boundary

- Supplier Network remains the canonical capacity declaration authority.
- Discovery remains the deterministic matching/eligibility authority.
- Logistics provider normalization preserves quality and provenance; it does not select or execute providers.
- No new table, migration, capacity ledger, matching engine, provider execution path, procurement award, reservation, inventory mutation, or fulfillment side effect is introduced.

## Verification

The current checks run in Node 24 CI:
- Phase 19.7 deterministic matching regression.
- Phase 16.13.10 Logistics provider matching regression.
- Phase 21.14 cumulative regression, including Phase 21.3 projection coverage.
- Phase 21.18 current source/hash continuity check.
- Phase 21.17 migration compatibility regression.

## Historical record

`PHASE21.16-SOURCE-HASHES.sha256`, `PHASE21.16_IMPLEMENTATION_HANDOFF.md`, the Phase 21.16 regression, and `package.json` remain unchanged. The old Phase 21.16 hashes describe the September 2026 snapshot; they are not a current-source acceptance test. The new Phase 21.18 manifest records the current files independently.

**No release certification is inferred from this evidence record alone.**
