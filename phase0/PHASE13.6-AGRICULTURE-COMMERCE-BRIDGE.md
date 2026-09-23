# Phase 13.6 — Agriculture Commerce Bridge

## Objective
Bridge Agriculture Commodity/Offer/Buyer Demand into the existing Commerce order capability without creating AgricultureOrder, AgricultureFulfillment, or AgriculturePayment.

## Ownership
- Agriculture owns Commodity, Offer, and BuyerDemand vocabulary.
- Existing Commerce owns Order.
- Existing Fulfillment owns fulfillment lifecycle.
- Payment Core owns payment state and ledger behavior.

## Bridge
`Commodity → Offer → Buyer Demand → Core Commerce Order`

The bridge produces the normalized input expected by the existing marketplace/order capability and carries a deterministic idempotency key:
`agriculture-demand:<demandId>:offer:<offerId>`

## Deliberately not changed
- No database migration.
- No existing order engine rewrite.
- No AgricultureOrder/AgriculturePayment/AgricultureFulfillment.
- No direct database writes from the Agriculture module.
- No payment implementation.

## Verification
Run:
`npm run phase13.6:agriculture-commerce-test`

Then run the full Phase 12.8 regression gate and the Phase 0 Golden Regression.
