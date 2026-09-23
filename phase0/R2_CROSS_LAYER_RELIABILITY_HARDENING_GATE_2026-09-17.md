# SELLIFY R2 — Cross-Layer Reliability Hardening Gate

Date: 2026-09-17
Status: PASS — functional hardening gate
Release certification: BLOCKED pending Node >=24 runtime verification

## Objective

Validate that the R2 Golden Business Journey remains safe across the existing authorization, tenant isolation, idempotency/replay, transaction rollback, audit, event, and inventory boundaries without introducing a duplicate authority.

## Journey under test

Supplier Network Discovery → Procurement Demand → RFQ → Comparison → explicit Award → existing B2B Purchase Order → approval → Procurement Receiving → canonical Inventory movement.

## Source inspection

Validated before changes:
- `app/src/procurement/ui.js`
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- existing Phase 13.11 / 13.12 authorization, isolation, audit, and replay regressions
- existing R1 and R2 productization regressions

## Implementation

Added only:
- `phase0/r2-cross-layer-reliability-hardening-gate.mjs`
- this documentation file
- corresponding SHA-256 manifest

No application authority, API route, database migration, ledger, event store, replay store, or provider implementation was added.

## Gate assertions

10 / 10 PASS:
1. Procurement journey mutations remain authorization-gated.
2. Tenant and organization isolation remain canonical.
3. Idempotency remains domain-owned across journey writes.
4. Replay and conflicting payload behavior remain fail-safe.
5. Sensitive mutations retain canonical audit evidence.
6. Transaction rollback paths remain present around transactional mutations.
7. Receiving keeps physical inventory movement behind canonical Inventory authority.
8. UI create operations provide idempotency keys for primary create operations.
9. UI does not introduce client-side persistence or replay stores.
10. Existing authorization/mutation, isolation, audit, and replay regression suites remain the supporting historical evidence.

## Regression evidence

- R2 Golden Business Journeys: 13 PASS / 0 FAIL
- R1 Golden E2E Traceability: 13 PASS / 0 FAIL
- R2 Cross-Layer Reliability Hardening: 10 PASS / 0 FAIL
- Phase 0 Golden Regression: 21 PASS / 0 FAIL
- JavaScript syntax checks: PASS

Additional existing regression runs used as evidence:
- Phase 13.11.11 Idempotency / Replay: PASS
- Phase 13.11.14 Authorization / Tenant Isolation: PASS
- Phase 13.11.15 Audit / Observability: PASS
- Phase 13.12.5 Organization Isolation: 519 PASS / 0 FAIL
- Phase 13.12.8 Mutation Enforcement: 12 PASS / 0 FAIL
- Phase 13.12.10 Sensitive Action Audit: 12 PASS / 0 FAIL
- Phase 21.13 Adversarial / Idempotency: 13 PASS / 0 FAIL
- Phase 22.9 Adversarial / Idempotency: 22 PASS / 0 FAIL

## Architecture conclusion

R2 reliability hardening preserves the established source-of-truth model:

- Authorization remains the existing authorization authority.
- Tenant/organization/location isolation remains the existing isolation authority.
- Procurement state remains in the existing Procurement store.
- Purchase Orders remain in the existing B2B Purchase Order authority.
- Inventory movement remains canonical Inventory behavior.
- Audit remains the existing audit authority.
- Events remain behind the existing outbox/sync-event infrastructure.
- Idempotency remains enforced by canonical domain persistence and event identity.
- UI remains orchestration/presentation and does not become a transaction authority.

## Known runtime gate

The source declares Node >=24, while the current verification environment remains Node 22.x. Functional gates pass, but Node >=24 release certification remains blocked until verification is performed under the declared runtime.

## Next controlled step

Proceed to the next R2 evidence slice only if needed: production-scale/capacity evidence and representative failure/recovery testing. Phase 23 should remain deferred until R0–R2 productization and release gates are satisfied.
