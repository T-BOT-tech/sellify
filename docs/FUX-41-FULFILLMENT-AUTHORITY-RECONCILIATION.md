# FUX-41 — Fulfillment Authority Reconciliation

## Status

**AUDIT COMPLETE — IMPLEMENTATION DEFERRED**

This audit follows FUX-40 and inspects the canonical SQLite commerce/inventory authorities before changing the seller logistics UI.

## Finding

Sellify already has a canonical fulfillment model, but it is currently scoped to the Marketplace domain:

- `marketplace_seller_orders`
- `marketplace_fulfillments`
- `marketplace_inventory_reservations`
- `marketplace_settlements`

Marketplace checkout creates a canonical fulfillment row with:

- status: `pending`
- fulfillment type: `delivery`

The Marketplace status authority is separately server-side and transactional.

The ordinary seller order/logistics UI is different. `app/src/logistics/fulfillment.js` currently mutates the local order projection and, at terminal fulfillment, performs local inventory deduction. Therefore ordinary seller fulfillment is still not connected to a canonical backend fulfillment command.

## Authority boundary

Current:

```
Marketplace order
  -> canonical seller order
  -> canonical marketplace fulfillment
  -> canonical inventory consequences

Ordinary seller order
  -> local order
  -> local fulfillment_status
  -> local inventory mutation
```

This means the system currently contains **two fulfillment authorities**, but only one is canonical.

## Why the Marketplace fulfillment tables should not simply be reused

`marketplace_fulfillments` has a foreign key to `marketplace_seller_orders`.

Converting ordinary seller orders into marketplace seller orders would incorrectly couple the core seller order domain to Marketplace semantics.

That would violate Sellify's domain-separation rule:

> Packs and experiences may compose Core; they must not manufacture another Core transaction authority.

The correct solution is therefore a **generic Core fulfillment authority**, with Marketplace fulfillment remaining a domain-specific projection/extension where appropriate.

## Required Core contract

The eventual canonical Core fulfillment boundary should support at minimum:

- order reference
- organization/tenant scope
- location scope
- fulfillment type: pickup | delivery
- canonical status
- destination/address metadata
- scheduled time
- tracking reference where applicable
- proof-of-delivery metadata where applicable
- actor/device provenance
- idempotency/event identity
- audit trail

The status machine must be server-owned.

A minimum initial state machine should preserve the existing UX intent:

```
delivery:
pending -> out_for_delivery -> delivered

pickup:
pending -> ready_for_pickup -> picked_up
```

Additional business statuses must not be introduced until their authority and UI semantics are defined.

## Inventory invariant

Fulfillment must not directly become a second inventory engine.

The canonical transition should atomically coordinate:

```
authorization
  -> fulfillment transition
  -> inventory consequence
  -> audit/event
  -> canonical response
```

The operation must be idempotent.

The existing local event guard:

```
fulfillment_sale:<orderId>:<productId>
```

is useful evidence, but it does not replace server-side idempotency.

## Authorization

The backend already has centralized authorization and tenant/location scope checks.

The eventual fulfillment command must use those existing authorities rather than introducing logistics-specific role logic in the client.

Operational roles such as warehouse/delivery must remain contextual capabilities, not frontend-only permissions.

## Offline behavior

The PWA may continue to represent an offline intent locally, but:

```
local delivered != server-confirmed delivered
```

The desired offline contract is:

```
UI intent
  -> QUEUED / UNKNOWN
  -> durable outbox
  -> server reconciliation
  -> canonical fulfillment result
  -> UI projection
```

No offline local status should be presented as a server-confirmed terminal fulfillment state.

## Decision

Do **not** patch the current logistics UI by calling the Marketplace fulfillment APIs.

Do **not** add another local/server shadow fulfillment store.

Do **not** make inventory mutation authoritative in the browser.

The next implementation step is a small Core fulfillment persistence/command boundary that can serve ordinary orders while preserving the existing Marketplace fulfillment model.

## Evidence reviewed

- `backend/server.js`
- `backend/lib/store-sqlite.js`
- `app/src/logistics/fulfillment.js`
- `app/src/logistics/ui.js`
- `app/src/sync/orders.js`
- canonical `inventory_movements` authority
- canonical Marketplace fulfillment schema and transaction path

## Certification result

| Area | Result |
|---|---|
| Existing canonical Marketplace fulfillment | PASS |
| Ordinary seller fulfillment canonical authority | NOT PRESENT |
| Server-side inventory authority | PRESENT |
| Ordinary seller fulfillment → inventory integration | NOT PRESENT |
| Central authorization foundation | PRESENT |
| Audit foundation | PRESENT |
| Idempotent inventory event primitive | PRESENT |
| Generic Core fulfillment contract | DEFERRED |
| Real-device fulfillment validation | DEFERRED |

**FUX-41 conclusion: the gap is real, narrow, and architectural. The safest next step is to add one Core fulfillment authority rather than extending the existing Marketplace-specific model.**
