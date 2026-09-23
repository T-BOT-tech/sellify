# SELLIFY — Phase 11.4 Marketplace Integrity

## Status

Implemented additively over the Phase 11.3 B2B Invoice source.

**Migration:** 20  
**Next phase:** 12 — Physical Commerce

## Source-of-truth principle

The existing marketplace checkout was inspected and preserved. It already:

- searches live marketplace listings;
- validates seller and product existence;
- validates marketplace listing state;
- validates live price/stock;
- performs the stock mutation transactionally;
- creates seller sub-orders;
- creates tracking credentials;
- supports seller-side status transitions.

Phase 11.4 does not replace that checkout.

## Canonical boundary

```text
MarketplaceOrder
      ↓
SellerOrder[]
      ↓
Fulfillment[]
      ↓
Payment Allocation
      ↓
Settlement
      ↓
Delivery
```

## Implementation

### 1. MarketplaceOrder

Added:

```text
marketplace_orders
```

Stores the canonical marketplace-level identity, buyer identity,
currency, total, status, tracking-token hash and optional idempotency key.

### 2. SellerOrder

Added:

```text
marketplace_seller_orders
```

Each existing marketplace seller sub-order is projected into a canonical
seller-order record without deleting or replacing the existing `orders` row.

### 3. Fulfillment

Added:

```text
marketplace_fulfillments
```

A canonical fulfillment record is created for each seller order.

The existing logistics implementation remains intact.

### 4. Inventory reservations

Added:

```text
marketplace_inventory_reservations
```

The existing transactional stock decrement remains authoritative for current
behavior. Reservation records provide the canonical marketplace control
boundary and are marked consumed at checkout and released exactly once on
cancellation.

SQLite `BEGIN IMMEDIATE` remains the race-protection mechanism for checkout.

### 5. Idempotency

Added:

```text
marketplace_checkout_idempotency
```

`POST /api/marketplace/checkout` accepts:

```text
Idempotency-Key
```

When supplied:

- the request is hashed;
- the first successful response is stored;
- a replay with the same key and same request returns the original response;
- reusing the key with a different request is rejected with `409`.

Existing clients that do not send the header remain compatible.

### 6. Buyer identity and risk controls

Authenticated checkout uses the server-side session user ID when a valid
session token is supplied.

Anonymous/public checkout continues to use the existing buyer identity
fields.

An active-order limit is applied per buyer identity to reduce rapid duplicate
checkout abuse.

A per-line quantity risk ceiling is also enforced.

### 7. Payment allocation

Added:

```text
marketplace_payment_allocations
```

The existing canonical Payment Core remains authoritative.

When a seller-order payment is created, the payment is linked to the
seller-order allocation. Full verified/reconciled payment moves the
allocation to `ALLOCATED` and the settlement to `READY`.

Provider-specific payment execution is not duplicated.

### 8. Settlement

Added:

```text
marketplace_settlements
```

Settlement starts as:

```text
PENDING
```

and becomes:

```text
READY
```

after full verified/reconciled payment.

Cancellation reverses pending/ready/held settlement state.

Actual provider/bank settlement execution remains a later boundary.

### 9. Refund allocation

Added:

```text
marketplace_refunds
```

Cancellation of a seller order:

1. releases canonical inventory reservations;
2. restores the existing stock projection exactly once;
3. creates a pending refund allocation when payment was allocated;
4. marks the payment allocation `REFUNDED`;
5. reverses the marketplace settlement.

Actual external provider refund execution remains with the Payment Provider
boundary.

### 10. Seller-level state machine

The existing transition machine remains:

```text
queued
  ↓
confirmed
  ↓
preparing
  ↓
ready
  ↓
completed
```

Cancellation remains available from the existing cancellable states.

The canonical SellerOrder mirrors the seller-level state, while
MarketplaceOrder status is aggregated from all seller orders.

## API change

Existing endpoint retained:

```text
POST /api/marketplace/checkout
```

New optional request header:

```text
Idempotency-Key: <stable-client-generated-key>
```

CORS preflight now permits:

```text
Idempotency-Key
```

No existing marketplace endpoint was removed.

## Migration

Migration 20 creates:

```text
marketplace_orders
marketplace_seller_orders
marketplace_fulfillments
marketplace_inventory_reservations
marketplace_payment_allocations
marketplace_settlements
marketplace_refunds
marketplace_checkout_idempotency
```

The migration is additive and repeat-safe through the existing forward-only
migration mechanism.

## Tests

Added:

```text
phase0/phase11.4-marketplace-integrity-regression.mjs
```

Coverage:

```text
idempotency replay
duplicate checkout protection
canonical MarketplaceOrder creation
canonical SellerOrder creation
Fulfillment creation
Inventory reservation creation/release
Payment allocation
Settlement readiness
Cancellation/refund allocation
Stock restoration
Concurrent stock race
```

The Phase 0 golden regression was also extended with an idempotency replay
assertion and migration-20 expectation.

## Verification

Static syntax checks were run across the modified JavaScript files and pass.

The available inspection runtime is Node 22.16.0. The project requires
Node >=24 because it uses Node's built-in `node:sqlite`.

Therefore the full runtime regression must be executed under Node >=24 before
the release is considered verified.

## What stayed unchanged

- Existing marketplace search.
- Existing marketplace checkout endpoint.
- Existing seller `orders` records.
- Existing transactional stock mutation.
- Existing seller order pull/sync behavior.
- Existing tracking-token mechanism.
- Existing seller status transition behavior.
- Existing Payment Core.
- Existing Inventory Ledger.
- Existing audit system.
- Existing PWA marketplace UI.
- Existing offline/PWA architecture.

## Next

Phase 12 — Physical Commerce.
