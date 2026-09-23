# Phase 16.4 — Canonical Integration Contracts

## Status
PASS — implementation and regression gate complete.

## Objective
Formalize a reusable integration boundary over the Phase 16.1 capability contracts and Phase 16.3 adapter framework without creating a new domain authority.

## Implemented
- `app/src/platform/integration-contract.js`
- `phase0/phase16.4-integration-contract-regression.mjs`
- `package.json` script: `test:phase16.4`

## Canonical flow
Consumer → Integration Contract → Canonical Capability → Adapter → External Provider → Existing Sellify Authority

An integration is metadata and boundary composition. It does not own persistence, commerce, inventory, payments, identity, authorization, invoices, ledgers, transactions, event storage, or an API gateway.

## Contract fields
- source / target
- canonical capability
- contract version
- direction: inbound / outbound / bidirectional
- operations
- tenant/country/regional/global scope
- status: declared / active / deferred
- optional Phase 16.3 adapter binding
- existing authorization
- existing domain transaction authority
- existing outbox only

## Security and authority rules
Unknown capabilities and unknown adapters fail closed. Duplicate integration IDs are rejected unless explicit replacement is requested. Forbidden ownership claims are rejected.

## Regression
Phase 16.4: 36 PASS / 0 FAIL.
Phase 16.3: 32 PASS / 0 FAIL.
Phase 16.2: 30 PASS / 0 FAIL.
Phase 16.1: 30 PASS / 0 FAIL.
Phase 16.0: 9 PASS / 0 FAIL.
Phase 15.20 compatibility gate: retained and must remain green.

## Runtime note
The current environment is Node 22.16.0. This does not certify the project requirement of Node >=24. The existing MODULE_TYPELESS_PACKAGE_JSON warning is pre-existing and was not changed in this increment.
