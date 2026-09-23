# SELLIFY — PHASE 17.5 IMPLEMENTATION HANDOFF

## Status
IMPLEMENTED + REGRESSION-VALIDATED

## Scope
Phase 17.5 establishes explicit procurement Award decision authority after deterministic RFQ comparison.

Flow:
Demand → Supplier Discovery → RFQ → Supplier Response → Comparison → Award → Phase 17.6 Execution Bridge

## Ownership
Procurement owns:
- Award decision record
- Award line selection
- Single-supplier and split awards
- Award lifecycle
- Award audit trail

Existing authorities remain owners of:
- B2B Quote
- B2B Purchase Order
- Commerce Order
- Inventory
- Payment
- Accounts Receivable
- Invoice
- Settlement

## State machine
DRAFT → CONFIRMED
DRAFT → CANCELLED

CONFIRMED and CANCELLED are terminal.

Demand moves SOURCING → AWARDED only when an award is confirmed.

## Award rules
- Award must reference the same organization, Demand, RFQ, and FINAL Comparison.
- RFQ must be CLOSED.
- Demand must be SOURCING.
- Each award line must reference a comparison offer.
- Only eligible, currently SUBMITTED supplier responses can be awarded.
- Award quantity cannot exceed the compared covered quantity.
- Aggregate awarded quantity per RFQ item cannot exceed requested quantity.
- Award lines snapshot supplier, response, price, quantity, lead time, validity, and comparison offer.
- Award confirmation does not mutate inventory, payment, settlement, B2B Quote, B2B PO, or Commerce Order.
- Idempotency uses request hashing; conflicting reuse returns 409.

## Platform contracts
Added `procurement.award` capability and procurement authority domain coverage.
Added versioned procurement award events:
- procurement.award.created
- procurement.award.confirmed
- procurement.award.cancelled

No new event store or broker was introduced.

## Migration
Migration 25:
- procurement_awards
- procurement_award_lines
- immutability triggers and indexes

## Validation
- Phase 17.5 contract regression: PASS
- Phase 17.5 integration regression: PASS
- Phase 17.1–17.4 procurement regressions: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL
- Node >=24 certification: still deferred; validation runtime is Node 22.16.0

## Next
Phase 17.6 — Approved Award → Existing B2B Purchase Order execution bridge.

The bridge must call the existing B2B PO authority rather than create a second PO model. It should define deterministic handling for single-supplier and split awards, PO line snapshots, buyer/customer identity, and execution idempotency before any fulfillment/inventory mutation.
