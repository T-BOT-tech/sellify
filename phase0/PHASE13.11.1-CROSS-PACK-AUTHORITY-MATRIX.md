# Phase 13.11.1 — Cross-Pack Authority Matrix

Status: COMPLETE — 2026-09-08

| Concern | Canonical owner | Agriculture | Restaurant | Warehouse | Logistics |
|---|---|---|---|---|---|
| Order | Commerce | consume | consume | consume | consume/reference |
| Product | Commerce | consume | consume | consume | reference |
| Stock | Inventory | consume | consume | consume | consume/reference |
| Inventory movement | Inventory | bridge | consume | bridge | no duplicate ledger |
| Payment | Payments | consume | bridge | consume/reference | consume/reference |
| Customer | Customers | bridge | consume | consume | reference |
| Location | Locations | consume | consume | bridge | reference |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` | consume | consume | integrate | coordinate/project |
| Audit | Audit | consume | consume | consume | consume |
| Agriculture entities | Agriculture | own | — | — | reference when needed |
| Restaurant entities | Restaurant | — | own | — | reference when needed |
| Warehouse entities | Warehouse | — | — | own | integrate/reference |
| Logistics entities | Logistics | reference | reference | reference | own |

## Forbidden parallel authorities

No pack may introduce or become authoritative for:

- `*Order`
- `*Inventory`
- `*Payment`
- `*Customer`
- `*Location`
- `*Fulfillment`
- a replacement inventory/payment/audit ledger

where the concern is already owned by Core.

## Decision

This matrix is the source-of-truth decision for Phase 13.11 integration work. A later implementation must not silently change ownership; ownership changes require a new explicit architecture decision and regression update.
