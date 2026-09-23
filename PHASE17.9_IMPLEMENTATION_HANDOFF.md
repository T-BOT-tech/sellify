# Phase 17.9 — Procurement Settlement

## Status
IMPLEMENTED — 2026-09-11

## Authority
Settlement is a capability of the existing Payment Core. Procurement does not own a second financial ledger and does not copy Marketplace settlement semantics.

## Meaning
A procurement settlement records the allocation of **CONFIRMED outbound Payment Core instructions** against an approved procurement-origin Purchase Order. Payment execution confirmation and settlement accounting are separate boundaries.

## Persistence
- `payment_procurement_settlements`: one settlement record per organization + procurement-origin PO.
- `payment_procurement_settlement_allocations`: immutable allocations of confirmed outbound intents.
- No duplicate payment ledger is introduced.

## Lifecycle
Derived from allocations:
- `OPEN`
- `PARTIALLY_SETTLED`
- `SETTLED`
- `CANCELLED`

The status is not manually advanced; it is recalculated from allocated confirmed payments.

## Controls
- Approved procurement-origin PO required.
- Supplier organization is read from the existing PO.
- Only `CONFIRMED` outbound payment intents can be allocated.
- Payment must belong to the same PO and organization.
- Currency must match.
- Allocation cannot exceed the payment amount.
- Allocation cannot exceed outstanding PO settlement balance.
- Same outbound intent can only be allocated once.
- Allocation records are immutable.
- Partial payments are supported.
- GET operations do not create settlement state.

## No side effects
Settlement does not mutate:
- inventory
- Commerce Orders
- B2B Quotes
- B2B Purchase Order totals/status
- AR
- invoices
- Marketplace settlements

## APIs
- `GET /tenants/:chatId/payments/procurement-settlements`
- `GET /tenants/:chatId/payments/procurement-settlements/purchase-orders/:purchaseOrderId`
- `POST /tenants/:chatId/payments/procurement-settlements/purchase-orders/:purchaseOrderId/allocate`

## Capability
`payments.procurement-settlement`

## Migration
29

## Validation
- Phase 17.9 settlement contract regression: PASS
- Phase 17.9 procurement settlement regression: PASS
- Phase 17.8 outbound payment regression: PASS
- Phase 17.7 receiving regression: PASS
- Phase 16.12 platform regression: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL
- Runtime: Node v22.16.0
- Node >=24 certification: deferred
