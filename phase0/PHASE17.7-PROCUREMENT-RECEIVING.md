# Phase 17.7 — Procurement Receiving

## Scope

Adds server-confirmed receiving for procurement-origin B2B purchase orders.
Receiving supports partial quantities and creates immutable receipt records.

## Authority boundary

- Procurement owns `procurement_receipts` and `procurement_receipt_lines`.
- Existing B2B Purchase Order remains the PO authority.
- Existing Inventory movement ledger remains the physical stock authority.
- Posted receipt lines delegate to `appendInventoryMovement()` with movement type `PURCHASE`.
- Event IDs are deterministic per receipt line for retry idempotency.

## Rules

1. Only APPROVED procurement-origin POs can be received.
2. A receiving location must belong to the buyer organization and be active.
3. Receipt lines must reference PO items and catalog products.
4. Quantity must be a positive integer.
5. Cumulative posted receipts cannot exceed ordered quantity.
6. Posted receipt records are immutable.
7. No payment, AR, invoice, settlement, or Commerce Order is created.
8. Partial receipts remain first-class; later receipts can complete the remaining quantity.
9. Inventory is mutated only through the existing inventory movement authority.

## Offline boundary

Draft receipt capture may be implemented later at the client layer, but canonical POSTED receipt state requires server confirmation.
