# Phase 21.9 — Procurement / Commerce Handoff

## Status
IMPLEMENTED / PASS

## Classification
EXTEND / COMPOSE existing canonical authorities.

Phase 21 remains a derived sourcing/intelligence layer. It does not become the
Procurement or Commerce transaction authority.

## Handoff model

`Sourcing Opportunity → canonical capability request → owning authority`

Procurement handoff delegates to the existing `procurement.demand` authority.
Commerce handoff delegates to the existing `commerce.order` authority.

The boundary itself creates no demand, RFQ, award, purchase order, Commerce
Order, inventory mutation, payment mutation, provider execution, or AI action.

## Authority map

| Capability | Authority |
|---|---|
| Commodity | Agriculture |
| Product identity | Product / Catalog |
| Supply Capability | Supplier Network |
| Capacity / Availability | Supplier Network |
| Sourcing Opportunity | Phase 21 derived projection |
| Procurement Demand | Procurement |
| RFQ / Comparison / Award | Procurement |
| Purchase Order | Existing B2B Purchase Order authority |
| Commerce Order | Commerce |
| Inventory | Inventory |
| Payment | Payment Core |
| External provider execution | Controlled adapter / owning domain |

## Safety invariants

- `UNKNOWN != SUCCESS`
- `ELIGIBLE != AUTHORIZED`
- `AUTHORIZATION != EXECUTION`
- `SOURCING OPPORTUNITY != PROCUREMENT AWARD`
- `SOURCING OPPORTUNITY != PURCHASE ORDER`
- `SOURCING OPPORTUNITY != COMMERCE ORDER`
- no duplicate transaction authority
- no persistence in the handoff boundary
- no provider credentials or provider execution
- AI is not an executor

## Verification

Phase 21.9 regression: **19 PASS / 0 FAIL**.

Cumulative Phase 21 regression: **164 PASS / 0 FAIL**.

Node >=24 verification remains deferred to the established runtime verification
phase; current source runtime is Node 22.x.
