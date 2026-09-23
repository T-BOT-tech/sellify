# PHASE 16.0 — PLATFORM BASELINE LOCK

## Status

**IMPLEMENTED — BASELINE LOCK PASS UNDER CURRENT RUNTIME; NODE >=24 CERTIFICATION REMAINS PENDING**

Phase 16 starts from the Phase 15.22 prepared final snapshot. This baseline does not replace or duplicate any Core authority. It freezes the architectural assumptions that Phase 16 platformization must preserve.

## Canonical Authorities

- Commerce / Orders / Products: existing Core commerce authority.
- Inventory / movements: existing inventory authority.
- Payments: existing payment authority.
- Customers: existing customer authority.
- Locations / organization scope: existing location and tenant authorities.
- Fulfillment: `app/src/logistics/fulfillment.js`.
- Documents / invoices: existing B2B invoice authority.
- Audit / compliance: existing Core audit/compliance authority.
- Events / outbox: existing versioned event boundary + durable outbox.
- Authorization: existing central authorization and tenant/location isolation layers.

## Phase 16 Rules

1. Platformization is additive; no rewrite of Core.
2. No platform database, commerce store, inventory store, payment ledger, identity store, authorization store, invoice ledger, event store, or regional transaction authority.
3. Platform capabilities consume canonical authorities through explicit contracts.
4. External systems use `Canonical Contract → Adapter → External Provider`.
5. Transactions remain `Transaction → Outbox → Versioned Event → Consumer`.
6. AI receives structured capabilities/intents, never unrestricted database authority.
7. Existing country and vertical boundaries remain subordinate to Core authorities.
8. Versioning is additive and backward-compatible unless a deliberate migration gate is approved.

## Starting Runtime State

The prepared Phase 15.22 snapshot requires Node `>=24`. The available runtime is Node 22.16.0, therefore Phase 16 development/regression may use the available runtime for compatibility checks, but no Node >=24 certification may be claimed.

## Baseline Gate

The Phase 16.0 regression verifies:

- package engine remains `>=24`;
- Phase 15.20 gate remains present;
- canonical event boundary remains versioned and outbox-backed;
- vertical pack contract continues to reject reserved Core entities;
- country pack contract remains authority-restricted;
- central authorization remains the authorization authority;
- no Phase 16 platform authority/store has been introduced.
