# Phase 11.3 — B2B PO Approval

## Purpose

Introduce the canonical Purchase Order and approval boundary after Quotes, without rewriting the existing Order system.

## Contract

```text
Accepted Quote
      ↓ snapshot
Purchase Order
      ↓ approval
Approved Purchase Order
      ↓ later bridge
Existing Order
```

Migration: **16**

Tables:

- `purchase_orders`
- `purchase_order_items`

A quote can produce at most one PO per organization. PO amounts, currency, product, quantity and unit prices are copied from the accepted quote so later quote/catalog/pricing changes cannot silently rewrite the PO.

## State machine

```text
DRAFT
  ↓
SUBMITTED
 ├── APPROVED
 ├── REJECTED
 └── CANCELLED

DRAFT → CANCELLED
```

Terminal states cannot transition again. PO line items are immutable once the PO leaves DRAFT.

## API

```text
GET   /tenants/:chatId/b2b/purchase-orders
POST  /tenants/:chatId/b2b/purchase-orders
GET   /tenants/:chatId/b2b/purchase-orders/:poId
PATCH /tenants/:chatId/b2b/purchase-orders/:poId
```

## Authorization

```text
b2b:po:view
b2b:po:create
b2b:po:approve
```

Buyer may create and submit. Buyer cannot approve/reject. Manager and owner can approve/reject through the central server authorization layer.

## Audit

Creation and every PO state transition use the existing append-oriented `audit_events` infrastructure. No second audit system is introduced.

## Compatibility

PO creation/approval does **not** create or mutate an Order in this increment. The PO-to-Order bridge is deliberately deferred until the later B2B workflow stages are ready.

## Regression

`phase0/phase11.3-b2b-po-approval-regression.mjs` covers:

- accepted-quote prerequisite
- money/currency snapshot
- custom pricing snapshot
- duplicate PO rejection
- state transitions
- terminal-state protection
- immutable submitted PO items
- buyer vs manager authorization
- migration 16
