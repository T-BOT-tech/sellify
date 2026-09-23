# Phase 13.10.4 — Logistics Proof / Return Contract

## Status

IMPLEMENTED — 2026-09-08

Defines validation for delivery proof and return semantics without creating a second persistence authority.

### Proof types

- photo
- signature
- code
- document
- other

A proof requires a stable reference. It may be attached to the existing fulfillment/order representation.

### Return states

- requested
- approved
- in_transit
- received
- rejected
- cancelled

Return semantics belong to Logistics; order identity remains Commerce-owned and any stock mutation remains Inventory-owned.

## Explicit non-goals

No return table, second inventory ledger, refund ledger, payment authority, or order authority is introduced.

Actual financial refund execution remains within the Payment Core/provider boundary.

## Verification

`phase0/phase13.10.4-logistics-proof-return-regression.mjs`
