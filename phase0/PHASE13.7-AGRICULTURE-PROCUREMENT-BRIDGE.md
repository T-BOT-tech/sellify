# Phase 13.7 — Agriculture Procurement Bridge

This increment introduces Agriculture `Supply` vocabulary and bridges it into the existing canonical B2B Quote and Purchase Order capabilities.

## Authority boundary

```text
Agriculture Supply
      ↓
Canonical B2B Quote
      ↓ accepted
Canonical B2B Purchase Order
      ↓ later controlled B2B stages
Core Order / AR / Invoice / Payment
```

Agriculture does not create an AgricultureOrder, AgriculturePurchaseOrder, AgriculturePayment, AgricultureReceivable, or AgricultureInvoice authority.

The existing Phase 11.3 PO contract remains authoritative: an accepted Quote is snapshotted into a Purchase Order, and PO creation/approval does not mutate an Order. The PO-to-Order bridge remains deliberately deferred.

## Isolation

All bridge references must belong to the same organization. Supply references the existing Farmer Customer and Core Product. Buyer is an existing canonical Customer.

## Verification

- `npm run phase13.7:agriculture-procurement-test`
- Phase 12.8 regression gate
- Phase 0 golden regression

Node 24 remains the supported release runtime; functional verification may be executed in the current environment but is not Node-24 release certification unless actually run under Node >=24.
