# FUX-44 — Frontend Fulfillment Authority Reconciliation

## Status

IMPLEMENTED — frontend Logistics fulfillment mutations now target Core Fulfillment authority.

## Authority boundary

Before FUX-44:

`Logistics UI → local order status → local warehouse stock mutation → localStorage`

After FUX-44:

`Logistics UI intent → Core Fulfillment API → server authorization → canonical fulfillment transition → canonical inventory consequence → canonical response → local UI projection`

The frontend no longer imports or calls `applyStockChange` from the fulfillment mutation path.

## Canonical API

Seller fulfillment transitions use:

`POST /tenants/:chatId/orders/:serverOrderId/fulfillment`

with:

- authenticated tenant session
- `Idempotency-Key`
- target canonical status
- optional location context

The backend remains authoritative for transition validity, authorization, tenant/location scope, audit, and terminal inventory consequences.

## Offline and unknown semantics

If the device is offline, the frontend writes a durable `fulfillment.transition` command to the existing command outbox.

The local order does **not** become `delivered` or `picked_up` merely because the user tapped the action.

If a network/5xx failure leaves the outcome unknown, the same deterministic idempotency key is queued so a later retry can safely replay the command.

A local order without `server_order_id` cannot receive a canonical fulfillment transition; the UI asks for synchronization rather than creating a second local authority.

## Reconnect reconciliation

When connectivity returns, the frontend flushes `fulfillment.transition` commands using their deterministic idempotency keys, then reads canonical fulfillment state for queued local projections.

A queued local state is therefore reconciled from server authority rather than promoted locally to a terminal state.

## Regression

`phase0/fux-44-fulfillment-frontend-authority-regression.mjs`

verifies the frontend uses the canonical endpoint, idempotency, server-order identity, offline/outbox handling, canonical response projection, and contains no local inventory mutation path.

## Remaining evidence

This source-level migration does not by itself prove physical Android/offline/reconnect behavior. Those remain device/runtime certification work.
