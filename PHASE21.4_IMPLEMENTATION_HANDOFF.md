# Phase 21.4 — Demand Requirement Implementation Handoff

## Status

IMPLEMENTED.

## Boundary

Phase 21 exposes a normalized Demand Requirement projection for deterministic supply matching. The canonical Procurement Demand authority remains authoritative for actual procurement demand, lifecycle, persistence, authorization, sourcing workflow, RFQ, award, and purchase-order progression.

## Authority map

- Procurement Demand: existing Procurement authority.
- Commodity vocabulary: Agriculture authority.
- Product identity: existing Product/Catalog authority.
- Destination: existing Locations authority.
- Inventory truth: existing Inventory authority.
- Orders / fulfillment: existing Commerce / Fulfillment authorities.

## Demand Requirement semantics

A Demand Requirement may represent:

- commodity reference
- quantity and unit
- specification
- destination
- required date
- qualification requirements
- logistics requirements
- commercial requirements
- provenance

It is a matching representation, not a new transaction record.

## Non-authority rules

Phase 21.4 does not create:

- a second Procurement Demand store
- an inventory reservation
- an order
- an RFQ
- an award
- a purchase order
- payment state
- supplier identity authority
- product/catalog authority
- persistence
- authorization
- provider execution

## Critical invariant

`Demand Requirement ≠ Procurement Demand record ≠ Commerce Order`.

Unknown demand status remains `UNKNOWN` and cannot be promoted to an active procurement state by the Phase 21 projection.

## Verification

The dedicated Phase 21.4 regression validates authority boundaries, reference integrity, quantity/unit, specification, destination, required date, qualification/logistics/commercial requirements, immutable projection, fail-closed invalid references, provenance copying, and absence of execution/persistence authority.
