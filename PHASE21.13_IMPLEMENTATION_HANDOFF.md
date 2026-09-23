# PHASE 21.13 — ADVERSARIAL / IDEMPOTENCY REGRESSION

**Status:** IMPLEMENTED / REGRESSION PASS
**Date:** 2026-09-15

## CURRENT PHASE
Phase 21.13 — Adversarial / Idempotency Regression

## OBJECTIVE
Attack the completed Phase 21.0–21.12 boundaries for replay, conflicting input, UNKNOWN handling, cross-border constraints, and accidental execution authority without introducing a new persistence or transaction authority.

## SOURCE INSPECTION
Inspected the actual Phase 21.11 snapshot and existing Phase 21 modules, including deterministic commodity match, sourcing opportunity, supply gap, cross-border integration, Agriculture integration, Supplier Network capability/capacity, and existing project handoff rules.

## CURRENT STATE
Phase 21 is composed of derived projections over canonical Agriculture, Supplier Network, Procurement, Commerce, Inventory, Payment, Logistics, Discovery, and Phase 20 Cross-Border authorities. Phase 21.13 is a regression hardening phase only.

## SOURCE OF TRUTH
Existing domain authorities remain unchanged. Phase 21 projections are not transaction authorities. Project-wide idempotency remains governed by the existing integration principles: same input must replay safely; conflicting payloads must not silently alias a prior result.

## PROPOSED CHANGE
Add a test-support module and adversarial regression covering:
- deterministic same-input replay
- unknown evidence never becoming success
- conflicting commodity identity
- execution-bearing fields rejected
- cross-border same-country rejection
- derived opportunity/gap remaining non-authoritative
- different payload not treated as identical replay

## FILES TO CHANGE
Added:
- `app/src/phase21-adversarial-idempotency-regression.js`
- `phase0/phase21.13-adversarial-idempotency-regression.mjs`
- `PHASE21.13_IMPLEMENTATION_HANDOFF.md`

Modified:
- `package.json` — additive `test:phase21.13` script only.

## MIGRATION
None. Regression helpers are persistence-free and mutation-free.

## TEST PLAN
Run Phase 21.13 directly, then rerun the prior Phase 21 regressions and relevant Phase 20/19 exits where available. Do not claim Node >=24 release verification from an unsupported runtime.

## RISKS
- A regression harness must not become production transaction logic.
- Replay equivalence must not erase meaningful provenance differences.
- UNKNOWN and conflicting evidence must remain non-success states.
- Cross-border feasibility must not become execution authority.

## IMPLEMENTATION RESULT
Implemented adversarial/idempotency regression coverage without creating a second authority.

## VERIFICATION
Phase 21.13 regression: **13 PASS / 0 FAIL**.

Runtime used: Node v22.16.0. This is not supported-runtime release verification because the project requires Node >=24.

## DELIBERATELY NOT CHANGED
- Procurement, Commerce, Inventory, Payment, Logistics, Supplier Network, Agriculture, Discovery, and Phase 20 authorities.
- Database schema and migrations.
- Event store/outbox implementation.
- Provider adapters.
- Existing Phase 21 production projections.

## NEXT STEP
Phase 21.14 — Cumulative Phase 21 Gate.
