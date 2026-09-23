# Phase 16.6 — Contract Versioning

## Status
PASS — implementation and regression gate complete.

## Objective
Introduce explicit, machine-verifiable version compatibility for canonical platform contracts without creating a migration store, registry database, broker, or replacement authority.

## Implemented
- `app/src/platform/contract-versioning.js`
- `app/src/platform/index.js` exports
- `phase0/phase16.6-contract-versioning-regression.mjs`
- `package.json` script: `test:phase16.6`

## Version policy
- Contract versions use `MAJOR.MINOR` or `MAJOR.MINOR.PATCH`.
- Breaking changes require a new major version.
- Minor and patch changes are additive-compatible when the provider version is at least the consumer minimum and the major versions match.
- Major-version mismatches fail closed.
- A provider below the consumer minimum fails closed.

## Canonical flow
Consumer minimum contract version → Version compatibility check → Existing capability / adapter / integration contract → Existing authority.

Versioning is metadata-only. It does not execute migrations, persist version state, or replace domain transaction, authorization, payment, inventory, commerce, invoice, customer, location, fulfillment, audit, country, vertical, or event authorities.

## Security / authority rules
The versioning layer declares:
- `persistence: none`
- `migrationStore: none`
- existing contract authority only
- no duplicate authority
- no duplicate event store
- no duplicate transaction engine

## Regression
Phase 16.6: 35 PASS / 0 FAIL.
Phase 16.5: 33 PASS / 0 FAIL.
Phase 16.4: 36 PASS / 0 FAIL.
Phase 16.3: 32 PASS / 0 FAIL.
Phase 16.2: 30 PASS / 0 FAIL.
Phase 16.1: 30 PASS / 0 FAIL.
Phase 16.0: 9 PASS / 0 FAIL.
Phase 15.20 compatibility gate: 126 PASS / 0 FAIL.

## Runtime note
Current environment is Node 22.16.0. This does not certify the project requirement of Node >=24. The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains unchanged.
