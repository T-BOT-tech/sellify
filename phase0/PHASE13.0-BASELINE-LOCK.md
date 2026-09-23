# Sellify Phase 13.0 — Baseline Lock

## Source of truth

Phase 13 begins from the supplied:

`SELLIFY_PHASE12_8_REGRESSION_GATE_2026-09-07.zip`

The archive was extracted and the actual source was inspected before Phase 13.1 changes.

## Phase 12.8 gate

The authoritative `phase0/phase12.8-regression-gate.mjs` was executed before Phase 13.1 and passed every check:

- Phase 12.1 Physical/Printing Contract
- Phase 12.2 Fulfillment Bridge
- Phase 12.3 Physical Lifecycle
- Phase 12.4 Printing Contract
- Phase 12.5 ESC/POS Adapter
- Phase 12.6 Web Bluetooth Adapter
- Phase 12.7 Warehouse Hardening
- Phase 11.4 Marketplace Integrity
- Phase 0 Golden Regression — 21 PASS / 0 FAIL

Observed verification runtime: Node `v22.16.0`.

The project remains declared for Node `>=24`; the Phase 12.8 gate does not override that requirement.

## Existing authorities locked for Phase 13

Phase 13 must preserve these existing authorities and bridge vertical capabilities into them:

- Commerce / Orders
- Inventory and canonical inventory ledger
- Payments
- Customers / identity
- Locations
- Fulfillment
- Documents
- Audit
- Existing Restaurant implementation
- Existing Warehouse implementation
- Existing Logistics implementation

## Non-rewrite rule

No Phase 13 work may:

- replace the existing Orders system;
- replace inventory mutation or the canonical inventory ledger;
- create a second payment authority;
- create a second customer authority;
- create a second location authority;
- create a second fulfillment authority;
- rewrite Restaurant, Warehouse, or Logistics;
- introduce a dynamic plugin marketplace merely to support vertical packs.

## Baseline identity

- Project package version: `0.2.0`
- Backend migration chain observed: versions `1` through `21` (Phase 17.1 procurement demand)
- Node engine: `>=24`
- Phase 12.8 regression gate: PASS
- Phase 13.1 regression: PASS

## Phase 13.0 exit status

**LOCKED.**

The baseline is frozen for incremental Phase 13 work. The next approved step is Phase 13.1 — Vertical Pack Contract.
