# SELLIFY P0-IMPLEMENTATION-03 — Procurement → Warehouse Receiving

## Scope

This slice productizes the existing Procurement → Warehouse receiving boundary in the Warehouse Receiving surface.

It does **not** create a new receipt authority, inventory authority, ledger, PO store, or authorization engine.

## Existing canonical authorities reused

- Procurement owns the procurement receipt record.
- Inventory remains the physical stock / ledger authority.
- Approved procurement-origin purchase orders are the only POs surfaced for this receiving action.
- The existing `POST /tenants/:chatId/procurement/purchase-orders/:poId/receipts` endpoint is used.
- Server-side authorization remains authoritative.

## UI behavior

- Signed-out / missing session → UNKNOWN state.
- Unauthorized role → PERMISSION_DENIED state.
- Offline → OFFLINE state; no claim of successful receipt.
- Server load → LOADING → SUCCESS or FAILURE.
- Only `APPROVED` procurement-origin POs are actionable.
- Receipt quantities are positive integers and constrained by the canonical backend.
- Each submission carries an idempotency key.
- Confirmation is shown only after the canonical API succeeds.

## Files changed

- `app/src/warehouse/procurement-receiving.js`
- `app/src/warehouse/ui.js`
- `app/index.html`
- `phase0/p0-03-procurement-receiving-ui-regression.mjs`

## Validation

- JavaScript syntax checks: PASS
- P0-03 focused regression: PASS
- FUX-29 Seller Golden Journey regression: PASS
- FUX-30 Multi-channel adversarial regression: PASS

Node 24+ certification remains a separate runtime gate.
