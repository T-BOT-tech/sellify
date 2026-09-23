# Phase 13.10.9 — Shipment / Tracking Reference

**Status:** Implemented and regression-tested — 2026-09-08

## Objective

Formalize the existing Shipment / Tracking Reference capability over the Core Order and Fulfillment fields without creating a second shipment store, tracking ledger, fulfillment authority, or carrier system.

## Canonical boundary

```text
Core Order
  ↓
shipment_id / tracking_reference
  ↓
Logistics coordination / projection
```

External carrier/provider tracking remains external authority when the tracking state is externally owned:

```text
External Carrier / Provider
  ↓
Controlled Adapter
  ↓
Canonical Shipment / Tracking Contract
  ↓
Sellify Core Order
```

## Implemented

- `app/src/verticals/logistics/shipment-tracking-contract.js`
- `normalizeShipmentTracking()` validates and normalizes existing shipment/tracking values.
- Existing Core Order `shipment_id` and `tracking_reference` remain authoritative.
- Same-reference replay is safe and deterministic.
- Conflicting shipment IDs or tracking references are rejected.
- Tracking source is explicitly bounded to `sellify`, `carrier`, `provider`, `manual`, or `other`.
- Carrier/provider source is metadata about external authority; it does not create a provider database or internal tracking ledger.
- The contract is persistence-neutral and does not mutate the source order.

## Authority

| Concept | Authority |
|---|---|
| Order | Commerce / existing Core Order |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` |
| Shipment / tracking fields | Existing Core Order fields |
| External carrier tracking | External carrier/provider when externally owned |
| Logistics coordination | Logistics Pack |
| Stock mutation | `app/src/warehouse/inventory.js#applyStockChange` |
| Audit | Existing Core Audit |

## Migration

None. No new persistence model is introduced.

## API

No HTTP API was added in this increment. The contract is an internal, persistence-neutral capability boundary.

## Idempotency / conflict policy

- Same shipment/tracking reference replay → accepted as the same canonical projection.
- Existing shipment ID + different incoming shipment ID → rejected.
- Existing tracking reference + different incoming tracking reference → rejected.
- Missing both shipment ID and tracking reference → rejected.
- Unsupported tracking source → rejected.

## External adapter rule

No carrier/provider integration was implemented. Provider-specific behavior remains outside the Logistics Pack core and must later enter through:

`Canonical Contract → Adapter → Provider`

## Tests

`phase0/phase13.10.9-logistics-shipment-tracking-regression.mjs` verifies:

- canonical shipment/tracking normalization;
- contract validation;
- replay of existing values;
- source-order immutability;
- carrier-source authority metadata;
- missing-reference rejection;
- conflicting-reference rejection;
- unsupported source rejection;
- unsupported fulfillment type rejection;
- no duplicate shipment/tracking authority.

## Runtime

Tested with Node `v22.16.0` in the current environment.

Node `>=24` release verification remains a separate gate because the project uses `node:sqlite`. Node 22 regression evidence must not be represented as Node >=24 certification.

## Scope boundary

This increment does not implement:

- carrier APIs;
- webhook ingestion;
- provider-specific tracking clients;
- route optimization;
- external reconciliation;
- a second shipment database;
- a second tracking ledger.
