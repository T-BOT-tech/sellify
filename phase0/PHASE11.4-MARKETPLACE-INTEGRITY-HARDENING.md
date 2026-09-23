# Phase 11.4 Marketplace Integrity Hardening

## Scope

This increment hardens two cross-domain integrity boundaries without replacing
the Phase 11.4 marketplace model:

1. split/partial payments against one canonical seller-order allocation;
2. inventory-ledger reversals when a marketplace order is cancelled.

## Payment integrity

A seller-order allocation remains the canonical monetary ceiling.

Multiple Payment Core records may now contribute to one seller-order allocation.
Only verified/reconciled payment value counts toward settlement readiness.

Rules:

- the same Payment Core record is updated rather than duplicated;
- additional verified/reconciled payments may cover a remaining allocation balance;
- the verified sum cannot exceed the seller-order allocation;
- settlement becomes `READY` only when verified/reconciled value reaches the
  canonical seller-order amount;
- cancellation refund creation is limited to verified/reconciled payments.

## Inventory integrity

Marketplace checkout continues to decrement the existing catalog stock
projection and records a canonical `SALE` inventory movement.

Marketplace cancellation now also records a deterministic `RETURN`
inventory movement with:

`marketplace-cancel:{marketplace_order_id}:{seller_id}:{product_id}`

The stock projection and append-only inventory ledger therefore move together:

`OPENING_BALANCE + SALE + RETURN = current balance`

`INSERT OR IGNORE` plus the seller-order cancellation state machine prevents
duplicate cancellation movement.

## Regression coverage

The Phase 11.4 regression now verifies:

- checkout idempotency;
- stock decrement;
- inventory-ledger sale balance;
- verified payment allocation;
- cancellation stock restoration;
- inventory-ledger return balance;
- exactly one cancellation movement;
- split payments;
- settlement readiness after complete verified split payment;
- rejection of payment value above the canonical seller allocation;
- existing concurrent checkout race protection.

## Runtime status

The repository declares Node `>=24`. Any execution under an older Node version
is diagnostic only and is not supported-runtime certification.

## Payment-to-order identity bridge

The Payment Core uses `orders.server_order_id` as its canonical order reference,
while `marketplace_seller_orders.seller_order_id` retains the marketplace
legacy/local order ID. The marketplace payment bridge now resolves either
identity to the same canonical SellerOrder.

This prevents a valid Payment Core record from becoming orphaned from its
marketplace allocation merely because it references the server order UUID.
