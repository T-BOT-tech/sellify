# Phase 21.6 — Sourcing Opportunity

## Status
IMPLEMENTED

## Boundary
Phase 21.6 derives a sourcing opportunity from an existing Procurement demand representation, Supplier Network supplier/capability references, and an already evaluated Phase 21 deterministic commodity match.

## Authority rule
The opportunity is a derived projection. It does not become a procurement award, purchase order, commerce order, inventory reservation, payment instruction, fulfillment instruction, provider execution, supplier registry, commodity registry, or ranking/trust authority.

## Status mapping
- MATCH -> ELIGIBLE
- CONDITIONAL_MATCH -> CONDITIONAL
- PARTIAL_MATCH -> PARTIAL
- NO_MATCH -> NOT_ELIGIBLE
- UNKNOWN -> UNKNOWN

UNKNOWN never becomes success.

## Source authorities
- Commodity: Agriculture
- Demand: existing Procurement authority
- Supplier and Capability: existing Supplier Network authority
- Product: existing Product/Catalog authority
- Inventory: existing Inventory authority
- Commerce: existing Commerce authority
- Payment: existing Payment authority
- Logistics/Fulfillment: existing owning authorities

## Non-ownership
- persistence: none
- mutation: false
- ranking: false
- authorization: false
- procurement award: false
- inventory reservation: false
- order creation: false
- payment execution: false
- provider execution: false

## Determinism
The same references and deterministic match status produce the same derived opportunity identity unless an explicit opportunity identifier is supplied.

## Phase 21 principle
SOURCE → MATCH → OPPORTUNITY → HANDOFF. Acquisition remains with the owning domain.
