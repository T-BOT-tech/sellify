# Phase 16.5 — Capability Discovery

## Status
PASS — implementation and regression gate complete.

## Objective
Provide a metadata-only discovery surface so platform consumers can discover canonical capabilities, supported actions, owning authorities, adapters, and integrations without receiving database handles, credentials, authorization grants, transaction handles, or execution authority.

## Implemented
- `app/src/platform/capability-discovery.js`
- `app/src/platform/index.js` exports
- `phase0/phase16.5-capability-discovery-regression.mjs`
- `package.json` script: `test:phase16.5`

## Canonical flow
Consumer → Capability Discovery → Capability Contract → Existing Authority

Discovery is descriptive only. It does not execute actions, authorize callers, persist state, or replace any existing authority.

## Discovery surface
- canonical capabilities and actions
- canonical authority ownership
- capability status and contract version
- registered adapter metadata
- registered integration metadata
- metadata-only execution boundary

## Security and authority rules
Sensitive fields such as database/store/persistence/credentials/secrets/authorization grants/transaction handles/ledgers are rejected or omitted. Unknown capabilities and unsupported actions fail closed through the existing capability contract. Existing authorization and domain transaction authorities remain authoritative.

## Regression
Phase 16.5: 33 PASS / 0 FAIL.
Phase 16.4: 36 PASS / 0 FAIL.
Phase 16.3: 32 PASS / 0 FAIL.
Phase 16.2: 30 PASS / 0 FAIL.
Phase 16.1: 30 PASS / 0 FAIL.
Phase 16.0: 9 PASS / 0 FAIL.
Phase 15.20 compatibility gate: 126 PASS / 0 FAIL.

## Runtime note
The current environment is Node 22.16.0. This does not certify the project requirement of Node >=24. The existing MODULE_TYPELESS_PACKAGE_JSON warning is pre-existing and was not changed in this increment.
