# Phase 12.3 — Physical Lifecycle Tests

**Status:** Implemented as a regression-only increment  
**Date:** 2026-09-07  
**Scope:** Verify the existing pickup/delivery lifecycle and its existing inventory-deduction boundary without replacing the lifecycle implementation.

## Source inspection

Phase 12.2 source was inspected before adding the tests.

The existing authoritative lifecycle remains:

- `app/src/logistics/fulfillment.js`
- `nextFulfillmentStatus(order)` defines the transition graph.
- `advanceFulfillmentOrder(orderId)` persists the existing order fields.
- `isFulfillmentFinal(status)` defines `delivered` and `picked_up` as terminal states.
- Final-state stock deduction remains guarded by `stock_deducted` and uses `warehouse/inventory.js` → `applyStockChange()`.

No lifecycle implementation was rewritten.

## Verified lifecycle contracts

### Delivery

```text
pending → out_for_delivery → delivered
```

The regression verifies that stock is unchanged before the final state and is
reduced exactly once when the order reaches `delivered`.

### Pickup

```text
pending → ready_for_pickup → picked_up
```

The regression verifies that stock is unchanged before the final state and is
reduced exactly once when the order reaches `picked_up`.

### Invalid transitions

The existing state machine must return `null` for:

- unsupported fulfillment types
- delivery orders in pickup-only states
- already-final delivery orders
- already-final pickup orders

Calling the existing advance function for an invalid state must not mutate the
order or inventory.

### Duplicate/final transition behavior

A second call against a terminal order is a no-op because
`nextFulfillmentStatus()` returns `null` for the final state. The regression
checks that no second stock transaction or inventory movement is created.

### Inventory boundary

The test confirms that final fulfillment continues to use the existing
`applyStockChange()` path and therefore creates the existing `sold` stock
transaction plus the canonical `SALE` inventory movement.

No second inventory engine is introduced.

## Test implementation

Added:

```text
phase0/phase12.3-physical-lifecycle-regression.mjs
```

The test uses a minimal browser surface only to load the existing browser
modules under Node. It does not mock or replace the fulfillment state machine
or inventory mutation function.

Added npm command:

```bash
npm run phase12.3:lifecycle-test
```

## Verification

Passed in the available local runtime:

```text
Phase 12.1 Physical Commerce / Printing Contract Regression: PASS
Phase 12.2 Fulfillment Compatibility Bridge Regression: PASS
Phase 12.3 Physical Lifecycle Regression: PASS
Phase 11.4 Marketplace Integrity Regression: PASS
Phase 0 Golden Regression: 21 PASS, 0 FAIL
```

Syntax checks also passed for the Phase 12 logistics/test modules.

The project declares Node `>=24`. The available runtime is Node 22, so this
verification is not represented as Node 24 release certification.

## Deliberately unchanged

- `app/src/logistics/fulfillment.js`
- `app/src/logistics/physical-flow.js`
- `app/src/warehouse/inventory.js`
- order schema
- checkout flow
- warehouse module
- logistics UI
- backend marketplace fulfillment
- Payment Core
- printing adapters

## Release boundary

Phase 12.3 verifies the current physical lifecycle. It does not introduce a
new fulfillment engine, new persistence model, or new inventory authority.

The next bounded increment is **12.4 — Printing Contract**.
