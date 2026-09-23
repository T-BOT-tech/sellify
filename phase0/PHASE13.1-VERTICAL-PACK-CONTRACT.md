# Sellify Phase 13.1 — Vertical Pack Contract

## Status

**Implemented and regression-tested.**

Phase 13.1 establishes the smallest useful declarative boundary for vertical packs. It does not introduce dynamic module loading, a plugin marketplace, a second event system, or replacement domain authorities.

## Contract

Implementation: `app/src/verticals/contract.js`

Each pack declares:

- `contract_version`
- `pack_id`
- `name`
- `version`
- `capabilities`
- `configuration`
- `permissions`
- `domain_entities`
- `core_dependencies`
- `routes`
- `ui_entry_points`
- `events`

`defineVerticalPack()` validates and returns a detached, frozen manifest.

## Core-authority rule

The contract recognizes these existing Core authorities:

- commerce
- inventory
- payments
- customers
- locations
- fulfillment
- documents
- audit

A vertical may depend on these authorities but may not claim their canonical entities as vertical-owned entities.

Examples of prohibited vertical-owned entities include `Order`, `Inventory`, `Payment`, `Customer`, `Location`, and `Fulfillment`.

This prevents the Phase 13 vertical layer from creating parallel transaction or inventory authorities.

## Agriculture compatibility

The first intended substantive pack can own vertical concepts such as:

- Farmer
- Farm
- Plot
- Season
- Crop
- Harvest

Those concepts bridge to existing Core capabilities rather than creating AgricultureOrder, AgricultureInventory, AgriculturePayment, or AgricultureFulfillment.

## Explicit non-goals

Phase 13.1 does not:

- modify the database schema
- add a migration
- replace Orders
- replace Inventory
- replace Payments
- replace Customers
- replace Locations
- replace Fulfillment
- dynamically load arbitrary third-party plugins
- introduce a plugin marketplace
- create vertical-specific copies of Core authorities

## Verification

Regression: `phase0/phase13.1-vertical-pack-contract-regression.mjs`

Verified checks include:

1. valid Agriculture-style manifest accepted;
2. contract version and identity preserved;
3. manifest and declarative arrays frozen;
4. duplicate values rejected;
5. Core-owned entities rejected as vertical-owned entities;
6. unknown Core dependencies rejected;
7. validity helper returns expected results.
