# Phase 13.10.11 — Returns Workflow

**Status:** COMPLETE — 2026-09-08

## Objective

Formalize the Logistics Return workflow over the existing Core order/commerce state without introducing a second return database, order authority, inventory ledger, or payment authority.

## Actual source inspected

Before implementation, the Phase 13.10.10 source archive was extracted and the following were inspected:

- `app/src/verticals/logistics/proof-return-contract.js`
- `app/src/verticals/logistics/authority-map.js`
- `app/src/verticals/logistics/fulfillment-boundary.js`
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/physical-flow.js`
- `app/src/orders/checkout.js`
- `app/src/storage/migration.js`
- existing Phase 13.10 Logistics regressions

The existing Logistics contract already defined Return semantics and these statuses:

`requested`, `approved`, `in_transit`, `received`, `rejected`, `cancelled`.

## Implemented workflow

```text
requested
  ├──> approved ──> in_transit ──> received
  ├──> rejected
  └──> cancelled

approved ──> cancelled
```

Terminal states are `received`, `rejected`, and `cancelled`.

Replaying the current status is safe and deterministic. Invalid state transitions are rejected rather than silently accepted.

## Authority boundary

| Concern | Authority |
|---|---|
| Return semantics / workflow | Logistics Pack |
| Order | Commerce / existing Core Order |
| Stock mutation | Inventory |
| Payment state | Payment Core |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` |
| Audit | Existing Core audit |

A return reaching `received` does **not** automatically mutate inventory. The existing inventory authority remains responsible for any later stock disposition; no new return-to-stock ledger path is created by this phase.

## Persistence

No migration was added.

No Logistics-specific return store was added. The transition result is persistence-neutral and declares `existing_core_state_only` so callers can persist through the existing Core authority when an existing return representation is available.

## Adapter boundary

No external carrier, courier, returns platform, webhook, or provider integration was added.

The boundary remains:

```text
Canonical Contract → Adapter → Provider
```

External systems are not allowed to become a second internal Return or Inventory authority.

## Idempotency / conflict policy

- Same current status requested again → safe replay.
- Unsupported status → reject.
- Invalid transition → reject.
- Terminal state cannot be advanced to another state.
- Existing Return identity and order identity are preserved across transitions.
- Input objects are not mutated.

## API

No HTTP API was added in this increment.

## Tests

Added:

- `phase0/phase13.10.11-logistics-returns-workflow-regression.mjs`

Package script:

```text
npm run test:phase13.10.11
```

## Non-goals

- No second inventory engine.
- No automatic stock restocking/disposition.
- No refund/payment mutation.
- No separate Return persistence model.
- No courier/carrier integration.
- No route optimization.
- No external webhook processing.

## Runtime

Observed implementation runtime: Node `v22.16.0`.

The project release requirement remains Node `>=24`; this phase does not claim Node >=24 certification.

## Exit

**PHASE 13.10.11 — RETURNS WORKFLOW COMPLETE**

Next approved step: **Phase 13.10.12 — Courier Assignment**.
