# FUX-42 — Core Fulfillment Authority

## Status

Implemented as a narrow Core boundary.

FUX-42 does **not** replace the Logistics Pack, Warehouse Pack, Marketplace fulfillment, or payment authority.

## Canonical boundary

```
Core Order
  ↓
Core Fulfillment
  ↓
vertical projections / logistics coordination
```

The new canonical persistence entity is:

`fulfillments`

It references the canonical Core Order by `server_order_id` and is scoped to the Order's organization.

## Initial lifecycle

Delivery:

`pending → out_for_delivery → delivered`

Pickup:

`pending → ready_for_pickup → picked_up`

The server owns these transitions. The client cannot declare a transition successful by changing local state.

## Scope

Each fulfillment records:

- Core order reference
- organization
- optional location
- fulfillment type
- canonical status
- destination
- scheduled time
- tracking reference
- proof metadata
- actor provenance
- version
- last command idempotency key
- timestamps

## Authorization

Core fulfillment mutations use the existing central authorization authority with:

- `fulfillment:view`
- `fulfillment:update`

Tenant and location scope are checked before mutation.

## Idempotency

Mutation requests require an `Idempotency-Key`.

A replay of the most recent command returns the existing canonical fulfillment state rather than applying the transition twice.

## Audit

Successful transitions emit the existing `audit_events` record:

`fulfillment.transitioned`

No second audit store is introduced.

## Deliberately deferred

FUX-42 does not yet:

- mutate inventory from fulfillment transitions
- introduce dispatch/route authority
- rewrite the existing Logistics Pack
- rewrite Warehouse inventory authority
- modify Marketplace fulfillment
- change payment behavior
- replace the frontend local fulfillment projection

Inventory consequences remain deferred to the existing canonical inventory authority so the next migration can be introduced with an explicit transaction boundary rather than creating a second stock engine.

## API boundary

Authenticated tenant-scoped endpoints:

- `GET /tenants/:chatId/orders/:serverOrderId/fulfillment`
- `POST /tenants/:chatId/orders/:serverOrderId/fulfillment`

POST requires `Idempotency-Key` and a target status.

## Regression

`npm run test:fux-42`

The regression verifies:

- Core fulfillment persistence
- delivery lifecycle
- server transition authority
- idempotent replay
- invalid transition rejection
- organization/location isolation
- separation from Marketplace fulfillment

## Architectural invariant

> UI intent → canonical fulfillment command → server authorization → canonical fulfillment state → audit → UI projection

Not:

> UI → local delivered flag → assumed server success.
