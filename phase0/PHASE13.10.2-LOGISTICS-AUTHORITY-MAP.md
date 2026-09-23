# Phase 13.10.2 — Logistics Authority Map

## Status

IMPLEMENTED — 2026-09-08

Logistics coordinates physical movement while existing Core domains remain authoritative for their canonical state.

### Authority map

- Courier / Route / Shipment / Delivery / Proof / Return semantics → Logistics Pack boundary
- Order → Commerce
- Stock quantity and movement → Inventory
- Payment state and ledger → Payment Core
- Customer identity → Customers
- Organization location → Locations
- Fulfillment lifecycle mutation → `app/src/logistics/fulfillment.js`
- Audit → Core Audit

The external logistics provider, when introduced in a future adapter phase, remains authoritative for provider-owned tracking until explicitly synchronized into the canonical boundary.

## Rule

One state, one authority. Logistics must not silently become a second owner of Order, Inventory, Payment, Customer, Location, Fulfillment, or Ledger state.

## Verification

`phase0/phase13.10.2-logistics-authority-map-regression.mjs`
