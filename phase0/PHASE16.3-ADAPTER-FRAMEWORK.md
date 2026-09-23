# Phase 16.3 — Canonical Adapter Framework

## Status
PASS — implementation and regression gate complete.

## Purpose
Formalize the platform adapter boundary without creating a second commerce, payment, inventory, persistence, authorization, transaction, ledger, or event-store authority.

## Canonical flow

`Canonical Capability Contract → Adapter → External Provider`

The adapter translates provider-specific behavior into an existing Sellify capability and delegates execution to the existing domain authority.

## Implementation

- `app/src/platform/adapter-framework.js`
- `phase0/phase16.3-adapter-framework-regression.mjs`
- `package.json` test script: `test:phase16.3`

## Guardrails

- Adapter registry is process-local metadata only.
- No adapter persistence.
- No adapter ledger.
- No adapter transaction authority.
- No adapter authorization store.
- No adapter event store or broker.
- Existing authorization remains authoritative.
- Existing domain transaction authority remains authoritative.
- Existing outbox remains the event-storage path.
- Unknown adapters fail closed.
- Unknown capabilities fail closed.
- Duplicate adapter IDs are rejected unless explicitly replaced.
- Provider implementations remain outside this canonical platform layer.

## Regression

- Phase 16.3: 32 PASS / 0 FAIL
- Phase 16.2: 30 PASS / 0 FAIL
- Phase 16.1: 30 PASS / 0 FAIL
- Phase 16.0: 9 PASS / 0 FAIL
- Phase 15.20 compatibility: PASS

## Runtime note

The current execution environment is Node 22.16.0. The project requirement remains Node >=24. This phase does not claim Node >=24 certification.
