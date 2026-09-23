# PHASE 17.4 — DETERMINISTIC RFQ COMPARISON

Status: IMPLEMENTED

## Scope

Phase 17.4 converts submitted supplier responses into an immutable, versioned procurement comparison snapshot. It does not make an award and does not create or mutate a B2B Quote, Purchase Order, Commerce Order, Inventory movement, Payment, AR record, or Settlement.

## Frozen policy

1. The buyer must close the RFQ before comparison.
2. Only `SUBMITTED` supplier responses participate.
3. Supplier coverage is evaluated line-by-line.
4. Partial line coverage is preserved; covered quantity is capped at requested quantity for comparable-cost calculation.
5. Comparable cost is `covered_quantity × unit_price_minor`. No freight, tax, duty, or other landed-cost inputs exist in Phase 17.4, so the system does not label this as landed cost.
6. Supplier ranking is deterministic: eligible → coverage ratio → complete coverage → comparable total → maximum lead time → validity → supplier name → supplier id.
7. Line ranking is deterministic: complete coverage → unit price → lead time → validity → supplier id.
8. A comparison is a versioned snapshot. Re-running comparison creates version N+1 and does not overwrite an earlier snapshot.
9. No LLM or AI decision is required.

## Data authority

- Procurement owns comparison snapshots.
- Organization remains supplier identity.
- RFQ response remains supplier-offer authority.
- Award remains a later procurement authority.
- Existing B2B Quote and Purchase Order remain authoritative commercial documents.

## API

- `GET /tenants/:chatId/procurement/comparisons`
- `GET /tenants/:chatId/procurement/comparisons/:id`
- `POST /tenants/:chatId/procurement/comparisons` with `{ "rfqId": "..." }`

## Exit criteria

- deterministic supplier comparison
- partial coverage represented
- line-level comparison represented
- versioned snapshots
- central authorization preserved
- tenant isolation preserved
- no duplicate financial/inventory/order authority
- regression and Phase 16.12 gates pass
