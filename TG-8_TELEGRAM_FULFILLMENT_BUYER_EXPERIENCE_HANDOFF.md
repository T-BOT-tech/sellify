# TG-8 — Telegram Fulfillment, Tracking, Proof of Delivery & Returns Buyer Experience

## Scope
Exposes seller-scoped buyer fulfillment information through the Telegram storefront while reusing existing Commerce, Marketplace Fulfillment and Logistics authorities.

## Implemented
- Buyer-authenticated fulfillment projection endpoint.
- Tracking reference visibility gated by `tracking` capability.
- Proof-of-delivery visibility gated by `proof_of_delivery` capability.
- Returns capability is surfaced honestly; no Telegram return store or mutation path was created because the current source has no canonical buyer return mutation endpoint.
- Buyer UI adds a Delivery & returns action to each Telegram order.
- Tenant and buyer identity isolation enforced server-side.

## Authority boundaries
- Order: Commerce / existing Marketplace Order.
- Fulfillment: existing `marketplace_fulfillments` authority.
- Tracking: existing Logistics/Commerce order fields.
- Proof: existing fulfillment `proof_json`.
- Returns: Logistics Pack semantics; mutation remains deferred until an existing canonical return workflow is exposed.
- Events/Audit: existing infrastructure.

## Explicit non-goals
No Telegram fulfillment database, shipment ledger, return database, inventory restock engine, payment engine, or duplicate logistics authority.

## Verification
TG-8 regression PASS; TG-1 through TG-7 PASS; Golden Regression 21 PASS / 0 FAIL. Node 22.16.0 used; Node >=24 certification remains blocked.
