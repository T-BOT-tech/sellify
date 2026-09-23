# Phase 13.3 — Agriculture Identity Bridge

## Status
Verified 2026-09-07.

## Purpose
Bridge Agriculture roles onto Sellify's existing canonical Customer and Location domains without creating parallel identity authorities.

## Canonical mappings
- Farmer → Customer
- Buyer → Customer
- CollectionCenter → Location

## Rules
- Agriculture does not create AgricultureCustomer or AgricultureLocation.
- References carry `organization_id` and `core_id` so tenant/org scope is explicit.
- A bridge rejects a Core record belonging to another organization.
- This phase creates no database migration and no new persistence authority.
- Commerce, Inventory, Payments, and Fulfillment remain Core dependencies and are not touched here.

## Verification
- Phase 13.1 Vertical Pack Contract: PASS
- Phase 13.2 Agriculture Foundation: PASS
- Phase 13.3 Agriculture Identity Bridge: PASS
- Phase 12.8 Physical Commerce Regression Gate: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL

Verification runtime: Node v22.16.0. Supported release runtime remains Node >=24.
