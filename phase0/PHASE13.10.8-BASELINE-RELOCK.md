# Sellify Phase 13.10.8 — Logistics Baseline Re-Lock

## Status

LOCKED — 2026-09-08

## Purpose

Phase 13.10.8 freezes the verified Phase 13.10.7 Logistics Pack boundary as the
starting point for the remaining Logistics implementation work.

This is a control-only increment. It introduces no new production behavior,
no new persistence model, no migration, and no external provider integration.

## Source of truth

The supplied Phase 13.10 Logistics Pack source archive was extracted and the
actual Logistics source, migration mechanism, package scripts, and Phase 13.10
regressions were inspected before this re-lock.

The pre-change source state is represented by:

- `phase0/PHASE13.10-SOURCE-HASHES.sha256`
- `phase0/PHASE13.10.8-BASELINE-SOURCE-HASHES.sha256`
- `SELLIFY_PHASE13_10_7_BASELINE_FOR_13_10_8_2026-09-08.zip`

The baseline archive SHA-256 is recorded in
`phase0/PHASE13.10.8-BASELINE-ARCHIVE-SHA256.txt`.

## Observed runtime

Node `v22.16.0` is available in the implementation environment.

The project release/runtime requirement remains Node `>=24` because the
project uses `node:sqlite`. Node 22 execution is regression evidence only and
is not Node >=24 release certification.

## Locked Logistics authorities

Logistics may own coordination semantics for:

- Courier
- Route
- Shipment
- Delivery
- Proof
- Return

The following remain Core authorities:

- Commerce / Orders
- Inventory / stock mutation and movement ledger
- Payment Core
- Customers
- Locations
- Existing Fulfillment lifecycle
- Audit

The existing fulfillment lifecycle authority remains
`app/src/logistics/fulfillment.js`.

The canonical stock mutation remains
`app/src/warehouse/inventory.js#applyStockChange`.

## Adapter boundary lock

No Phase 13.10 remaining increment may turn an external logistics provider
into a second internal Sellify authority.

The required integration shape remains:

```text
Canonical Contract → Adapter → Provider
```

External carrier tracking, provider execution, routing/optimization services,
webhooks, and provider-specific synchronization remain outside the internal
Logistics authority unless a later approved phase explicitly introduces the
corresponding adapter contract.

## Persistence lock

The Phase 13.10 baseline remains persistence-neutral for Logistics-specific
coordination semantics. No Logistics-specific database authority is introduced
by this re-lock.

The existing order/core state and existing fulfillment/inventory mechanisms
remain authoritative.

## Migration lock

No migration is added by Phase 13.10.8.

The existing forward-only migration mechanism is preserved and historical
migrations are not edited.

## Production behavior lock

Phase 13.10.8 must not change:

- order creation or order authority;
- inventory stock mutation or inventory ledger authority;
- payment state or payment ledger authority;
- customer or location authority;
- existing fulfillment state transitions;
- existing Logistics UI behavior;
- external provider integrations.

## Baseline verification

Before this re-lock, the existing Phase 13.10 source hash manifest was checked
with `sha256sum -c` and all 20 entries returned `OK`.

The existing Phase 13.10.7 regression gate is the behavioral baseline for the
remaining Logistics increments. Its previously recorded result is PASS under
Node `v22.16.0`; the supported Node >=24 release gate remains unresolved.

## Exit condition

Phase 13.10.8 is complete when:

1. the pre-change Phase 13.10 source hashes are frozen;
2. the pre-change source archive is created and hashed;
3. Logistics/Core authority boundaries are explicitly re-locked;
4. adapter/provider isolation is explicitly re-locked;
5. migration status is frozen as no migration;
6. a regression confirms the baseline hash set and control invariants;
7. no production behavior is changed by this increment.

**Phase 13.10.8 — BASELINE RE-LOCKED.**

Next approved implementation step: **Phase 13.10.9 — Shipment / Tracking Reference**.
