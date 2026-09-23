# Phase 13.10.12 — Courier Assignment

**Status:** COMPLETE
**Date:** 2026-09-08

## Objective

Formalize courier assignment as a Logistics coordination contract for an existing delivery without introducing a second order, fulfillment, location, courier registry, or external-provider authority.

## Actual source boundary

Existing source inspection confirmed that the current order/fulfillment model has no dedicated courier persistence field or courier registry. Therefore this increment deliberately adds a persistence-neutral assignment contract rather than inventing a new database authority.

The existing fulfillment lifecycle remains authoritative at:

`app/src/logistics/fulfillment.js`

Commerce remains authoritative for the order. Locations remain authoritative for location state.

## Contract

`app/src/verticals/logistics/courier-assignment-contract.js`

Provides:

- `normalizeCourier()`
- `assignCourier()`
- `isCourierAssignmentContract()`
- `logisticsCourierAssignmentContract()`

Courier sources are bounded to:

- `sellify`
- `carrier`
- `provider`
- `manual`
- `other`

An assignment requires an existing delivery identity, order identity, delivery fulfillment type, and courier identity.

## Idempotency / conflict policy

The deterministic assignment key is:

`courier:<delivery_id>:<courier_id>`

Replaying the same delivery/courier assignment is safe.

A different courier for an already assigned delivery is rejected rather than silently overwritten.

## Authority boundary

| Concern | Authority |
|---|---|
| Courier coordination semantics | Logistics Pack |
| Order | Commerce |
| Delivery lifecycle | `app/src/logistics/fulfillment.js` |
| Location | Locations Core |
| External courier/provider state | External provider where external |

No courier registry is created.
No second order authority is created.
No second fulfillment authority is created.
No inventory or payment mutation is performed.

## Adapter boundary

External courier/provider behavior remains behind:

`Canonical Contract → Adapter → Provider`

No live carrier API, webhook, route optimization, or provider synchronization is implemented here.

## Persistence / migration

Persistence: **none**.

Migration: **none**.

The contract is intentionally persistence-neutral until an approved later increment identifies an existing canonical persistence owner.

## Regression

`phase0/phase13.10.12-logistics-courier-assignment-regression.mjs` verifies:

- courier normalization;
- delivery-only assignment;
- canonical assignment shape;
- deterministic assignment key;
- same-assignment replay;
- conflicting courier rejection;
- invalid provider/source rejection;
- required identity validation;
- duplicate-authority protections;
- adapter-boundary declaration.

## Runtime

Observed implementation runtime: Node `v22.16.0`.

The project release requirement remains Node `>=24`; this phase does not claim Node >=24 certification.

## Exit

**PHASE 13.10.12 — COURIER ASSIGNMENT COMPLETE**

Next approved step: **Phase 13.10.13 — Routes Scope Decision Record (explicit non-build)**.
