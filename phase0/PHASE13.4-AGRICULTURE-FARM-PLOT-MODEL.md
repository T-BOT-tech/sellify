# Phase 13.4 — Agriculture Farm / Plot Model

## Status
Implemented 2026-09-07.

## Scope
Introduces the Agriculture-owned structural model:

Farmer → Farm → Plot → Season → Crop

The model is persistence-neutral. It does not create a database migration or a second
identity, inventory, commerce, payment, or fulfillment authority.

## Entities
- Farm: belongs to an organization and references the Agriculture Farmer role.
- Plot: belongs to a Farm.
- Season: belongs to a Farm.
- Crop: belongs to a Plot and Season.

## Rules
- Every entity carries explicit `organization_id`.
- Parent/child references must remain within the same organization.
- Plot must reference its supplied Farm.
- Season must reference its supplied Farm.
- Crop must reference its supplied Plot and Season.
- Agriculture-specific fields stay inside the Agriculture pack.
- Core Customer/Location/Inventory/Commerce/Payments/Fulfillment remain external dependencies.

## Verification
- Farm/Plot/Season/Crop construction: PASS
- Hierarchy validation: PASS
- Cross-organization rejection: PASS
- Phase 13.3 identity bridge regression: PASS
- Phase 13.2 foundation regression: PASS
- Phase 12.8 regression gate: PASS
- Phase 0 golden regression: 21 PASS / 0 FAIL

Verification runtime: Node v22.16.0. Supported release runtime remains Node >=24.
