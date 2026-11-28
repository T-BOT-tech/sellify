# Phase 17.7 — Procurement Receiving

## Scope

Adds server-confirmed receiving for procurement-origin B2B purchase orders.
Receiving supports partial quantities and creates immutable receipt records.

## Authority boundary

- Procurement owns `procurement_receipts` and `procurement_receipt_lines`.
- Existing B2B Purchase Order remains the PO authority.
- Existing Inventory movement ledger remains the physical stock authority.
- Procurement reserves ordered quantities in a durable `PENDING` receipt under a SQLite write transaction; pending reservations count against remaining PO quantities.
- Posting delegates synchronously to the existing `appendInventoryMovementInTransaction()` authority. Every receipt-line movement, the `POSTED` transition, and mandatory receipt audit evidence commit together or roll back together.
- No asynchronous operation is awaited while the shared SQLite transaction is open.
- Event IDs are deterministic per receipt line. Same-key retries resume the same pending receipt; changed payloads using the same key are rejected, including differences in line quantities.

## Rules

1. Only APPROVED procurement-origin POs can be received.
2. A receiving location must belong to the buyer organization and be active.
3. Receipt lines must reference PO items and catalog products.
4. Quantity must be a positive integer.
5. Cumulative PENDING and POSTED receipt reservations cannot exceed ordered quantity.
6. Posted receipt records are immutable.
7. No payment, AR, invoice, settlement, or Commerce Order is created.
8. Partial receipts remain first-class; later receipts can complete the remaining quantity.
9. Inventory is mutated only through the existing canonical inventory movement authority.
10. A failed multi-line posting leaves a durable PENDING receipt but no partial Inventory movement; retry can safely resume it.
11. Receipt audit failure rolls back all movement rows and leaves the PENDING receipt retryable.

## Offline boundary

Draft receipt capture may be implemented later at the client layer, but canonical POSTED receipt state requires server confirmation.
