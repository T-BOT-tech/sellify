# Phase 11.4 Marketplace Integrity — Continuation Execution Record

## Scope

This continuation does **not** alter the marketplace transaction, inventory,
payment, settlement, refund, or seller-order authorities. It corrects only
regression-control assumptions exposed by the supplied HTTP diagnostic source.

## Source inspection

The supplied `SELLIFY_PHASE11_4_HTTP_REGRESSION_DIAGNOSTIC.zip` was extracted
and inspected before changes. The actual backend source confirmed:

- SQLite path is controlled by `SELLIFY_DATA_DIR` in `backend/lib/store-sqlite.js`.
- The HTTP regression spawns the backend with an isolated `SELLIFY_DATA_DIR`.
- The same regression then imported `store-sqlite.js` in the parent process
  without setting that environment variable there.
- Therefore fixture creation occurred against the default database while the
  HTTP server read the isolated test database, producing `Unknown seller`.

## Narrow changes

1. `phase0/phase11.4-marketplace-integrity-regression.mjs`
   - sets the parent process `SELLIFY_DATA_DIR` / backup directory to the same
     isolated test directory as the HTTP child;
   - uses `sellerSession.organizationId`, which is the actual returned session
     field, rather than the non-existent `seller.organizationId`;
   - checks the payment-specific marketplace allocation row when validating
     single-payment allocation/refund state;
   - validates over-allocation at the actual current source boundary: payment
     creation rejects the excess amount with
     `MARKETPLACE_PAYMENT_ALLOCATION_EXCEEDED`;
   - sizes the final concurrent race fixture to the stock remaining after the
     preceding split-payment scenario.

2. `phase0/golden-regression.mjs`
   - updates the pull-queue assertion from one to two marketplace orders,
     matching the actual current behavior after two successful marketplace
     checkouts in the same golden run.

## Deliberately unchanged

No changes were made to:

- `backend/server.js`
- `backend/lib/store-sqlite.js`
- migration 20
- marketplace schemas
- Payment Core
- inventory ledger
- checkout implementation
- cancellation implementation
- settlement/refund logic
- frontend marketplace behavior
- authorization architecture

These remain the implementation source of truth.

## Verification

Observed runtime: Node `v22.16.0`.

Passed under the available runtime:

- Phase 11.1 Money Contract regression
- Phase 11.2 Payment Core regression
- Phase 11.2 Provider/Channel regression
- Phase 11.3 B2B custom pricing regression
- Phase 11.3 quotes regression
- Phase 11.3 PO approval regression
- Phase 11.3 credit terms regression
- Phase 11.3 accounts receivable regression
- Phase 11.3 invoice regression
- Phase 11.4 Marketplace Integrity HTTP regression
- Phase 11.4 Marketplace Payment Bridge probe
- Phase 0 Golden Regression: 21 PASS, 0 FAIL

The project declares Node `>=24` and uses `node:sqlite`. No supported-runtime
release certification is claimed because Node 24 is not available in this
execution environment.

## Result

The previously diagnosed Phase 11.4 HTTP checkout failure was confirmed as a
regression-harness database-environment mismatch, not an `Unknown seller`
marketplace business-logic defect.

The current Phase 11.4 HTTP regression passes after the harness-only correction.

## Phase 12.1 continuation — 2026-09-07

### Objective
Establish the first Physical Commerce compatibility boundary and a provider-neutral printing boundary without replacing existing fulfillment, inventory, or receipt behavior.

### Source inspection
Inspected the actual continuation source for:
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/ui.js`
- `app/src/orders/receipts.js`
- `app/src/orders/queue.js`
- `app/src/window-bridge.js`
- `backend/lib/store-sqlite.js`
- existing warehouse/inventory paths

### Implementation
Added:
- `app/src/logistics/physical-flow.js` — pure canonical physical-flow mapper over existing order fields.
- `app/src/printing/escpos.js` — provider-neutral ESC/POS encoder.
- `app/src/printing/bluetooth.js` — Web Bluetooth transport boundary with caller-supplied device-specific UUIDs.
- `phase0/phase12.1-physical-printing-regression.mjs` — regression coverage for the new pure contracts.

### Deliberately not changed
- Existing `fulfillment_type` / `fulfillment_status` order storage.
- Existing warehouse `applyStockChange()` authority.
- Existing marketplace fulfillment tables and payment/inventory authorities.
- Existing browser `window.print()` receipt path.
- Existing UI/window bridge wiring.

Reason: Phase 12.1 establishes additive contracts first; integration/cutover must follow the migration discipline and must not create duplicate authorities.

### Verification
- Phase 12.1 Physical Commerce / Printing Contract Regression: PASS
- Phase 11.4 Marketplace Integrity Regression: PASS
- Runtime observed: Node 22.16.0; Node >=24 release certification remains pending.
