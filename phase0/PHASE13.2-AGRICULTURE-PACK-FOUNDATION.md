# Sellify Phase 13.2 — Agriculture Pack Foundation

## Status

**Implemented and regression-tested.**

Phase 13.2 establishes the first Agriculture vertical vocabulary without creating a parallel commerce, inventory, payment, customer, location, or fulfillment authority.

## Agriculture-owned foundation

The pack declares these Agriculture concepts in dependency order:

1. Farmer
2. Farm
3. Plot
4. Season
5. Crop
6. Harvest
7. Commodity
8. CollectionCenter
9. Buyer

Implementation: `app/src/verticals/agriculture/pack.js`

## Core boundary

Agriculture depends on the existing Core authorities:

- Customers
- Locations
- Inventory
- Commerce / Orders
- Payments
- Fulfillment
- Audit

The foundation deliberately does **not** create:

- AgricultureOrder
- AgricultureInventory
- AgriculturePayment
- AgricultureFulfillment

Those bridges are deferred to the later Phase 13.3–13.6 steps.

## Entity foundation

`defineAgricultureEntity()` provides a small validation boundary for Agriculture-owned records. Every foundation entity requires:

- stable `id`
- `organization_id`
- `status` of `active` or `inactive`

It does not persist records or bypass the existing organization/identity authorities.

## Explicit non-goals

Phase 13.2 does not:

- add a database migration;
- create an Agriculture customer table;
- create an Agriculture inventory engine;
- create Agriculture orders or payments;
- add UI routes;
- introduce dynamic plugin loading;
- change existing restaurant, warehouse, logistics, inventory, order, payment, or fulfillment code.

## Verification

Regression: `phase0/phase13.2-agriculture-foundation-regression.mjs`

Command:

```bash
npm run phase13.2:agriculture-test
```

Expected result:

```text
Phase 13.2 Agriculture Pack Foundation Regression: PASS
```
