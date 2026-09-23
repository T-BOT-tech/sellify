# Phase 12.7 — Warehouse Hardening

**Status:** Implemented narrowly
**Date:** 2026-09-07
**Scope:** Harden the existing warehouse/inventory path used by physical fulfillment.

## Source inspection

Phase 12.6 source was inspected before modification. Existing warehouse ownership remains in:

- `app/src/warehouse/inventory.js` — stock mutation authority.
- `app/src/warehouse/ledger.js` — canonical inventory movement stream.
- `app/src/warehouse/locations.js` — organization-location bridge plus legacy bins.
- `app/src/warehouse/ui.js` — existing warehouse UI.
- `app/src/logistics/fulfillment.js` — existing physical lifecycle and final stock trigger.

No second warehouse module or inventory authority was introduced.

## Hardening changes

### 1. Final fulfillment preflight

Before a final pickup/delivery transition can mutate stock, the existing fulfillment path now verifies:

- Warehouse mode is enabled.
- The current role can edit inventory.
- Every order item with an item id resolves to an existing product.
- Tracked items have valid positive quantities.
- Tracked items have sufficient stock for the requested deduction.

If the preflight fails, the order remains at its current non-final fulfillment state and no partial stock mutation is made.

### 2. Stable fulfillment sale event ids

Physical-fulfillment stock movements now use a deterministic event id:

`fulfillment_sale:<orderId>:<productId>`

This gives the canonical inventory ledger a stable idempotency identity for each order/product sale movement while preserving the existing legacy stock transaction path.

### 3. Existing authorities remain intact

`applyStockChange()` remains the single local stock mutation function. It continues to update `product.stock`, append the legacy `stockTransactions` projection, and record the canonical inventory movement.

The fulfillment module remains the owner of the physical lifecycle state machine; it does not become an inventory module.

## Compatibility

No database migration was introduced.

No inventory schema replacement was introduced.

No existing warehouse UI, receiving flow, location CRUD, or canonical ledger API was replaced.

Orders with historical items that lack an item id continue to be treated as legacy/non-deductible rather than inventing product identity.

## Regression

Added:

```text
phase0/phase12.7-warehouse-hardening-regression.mjs
```

Covers:

- no partial deduction when a tracked item would overrun stock
- valid final fulfillment deduction
- canonical SALE movement references
- stable fulfillment sale event ids
- terminal-state idempotency
- missing-product protection

Run:

```bash
npm run phase12.7:warehouse-test
```

Required previous regressions were also rerun.

## Verification result

- Phase 12.3 lifecycle regression: PASS
- Phase 12.4 printing contract regression: PASS
- Phase 12.5 ESC/POS adapter regression: PASS
- Phase 12.6 Web Bluetooth adapter regression: PASS
- Phase 12.7 warehouse hardening regression: PASS
- Phase 0 golden regression: **21 PASS, 0 FAIL**

The available runtime is Node 22. The project declares Node >=24, so this work does not claim Node >=24 release certification.

## Next step

**Phase 12.8 — Phase 12 Regression Gate**
