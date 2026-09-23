# SELLIFY Phase 21.12 — Network Intelligence / Control Projection

Status: IMPLEMENTED

## Purpose

Provide derived network-level visibility over Phase 21 sourcing opportunities,
supply gaps, Discovery projections, Cross-Border projections, and existing
Supplier Network evidence without creating a new authority.

## Authority boundary

- Agriculture owns Commodity.
- Supplier Network owns supplier, capability, capacity, performance and trust evidence.
- Phase 19 owns Discovery matching/ranking.
- Phase 20 owns Cross-Border coordination/evaluation.
- Procurement owns acquisition state.
- Inventory owns stock truth.
- Commerce owns orders.
- Payment owns payment truth.
- Logistics/Fulfillment owns delivery execution.

## Explicit non-authority

This projection does not select or award suppliers, rank suppliers, calculate
trust scores, mutate inventory/procurement/commerce/payment/logistics, authorize
transactions, execute providers, or persist a second intelligence store.

## Invariants

- UNKNOWN is not success.
- Intelligence is not authorization.
- Authorization is not execution.
- Supply gap is not an Inventory fact.
- Sourcing opportunity is not a Procurement Award or Purchase Order.

## Verification

The phase regression validates read-only projection behavior, authority
references, gap aggregation, and rejection of foreign supplier authority.
Node >=24 verification remains deferred to Phase 21.15.
