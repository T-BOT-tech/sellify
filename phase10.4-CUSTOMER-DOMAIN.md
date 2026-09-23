# Phase 10.4 — Customer Domain

Status: implemented additively.

## Objective

Promote Customer to a first-class canonical business entity without replacing
existing `customer_name` / `customer_phone` order fields or the existing B2B
account model.

Target relationship:

```text
Organization
    ↓
Customer
    ↓
Order
    ↓
Payment / Document
```

A Customer belongs to an organization. A customer may optionally have a
`defaultLocationId`; the customer is not duplicated simply because an
organization has multiple locations.

## Backend contract

Authenticated tenant-scoped routes:

```text
GET   /tenants/:chatId/customers?q=&status=&limit=
POST  /tenants/:chatId/customers
GET   /tenants/:chatId/customers/:customerId
PATCH /tenants/:chatId/customers/:customerId
```

Authorization:

- owner / manager / cashier: `customers:view` + `customers:manage`
- staff: `customers:view`
- buyer / viewer: no seller customer-management access

The policy is enforced through Phase 10.3 central authorization.

## Data model

Migration 8 adds:

```text
customers
  id
  organization_id
  default_location_id
  customer_type
  name
  phone
  email
  address
  tax_id
  notes
  status
  source
  created_at
  updated_at
```

Migration 8 also adds nullable `orders.customer_id` and an organization-scoped
index. Existing orders remain valid with a null customer link.

## Compatibility

The implementation deliberately keeps:

- `customer_name`
- `customer_phone`
- existing order JSON
- existing B2B accounts
- existing checkout flow
- existing offline storage

New local orders may carry `customer_id`. When an order is synchronized, the
backend can resolve or create the canonical customer and persist the
relational link.

Natural-key matching uses phone first and, when no phone exists, normalized
name within the organization. This is a pragmatic MVP deduplication rule; a
future identity/CRM phase can introduce explicit merge tooling.

## Offline behavior

`app/src/customers.js` provides a local customer registry backed by the
existing IndexedDB/local-storage persistence layer. Checkout records the
customer locally before attempting server synchronization.

If the server is unavailable, the customer remains locally usable and the
existing offline order queue remains intact.

## UI

A lightweight Customers surface is added to the existing More sheet. It
supports:

- search
- create
- edit
- retail/business classification
- phone/email/address
- tax ID
- notes

No new navigation architecture or UI framework is introduced.

## Audit

Customer create/update operations use the existing `audit_events` pipeline.
No parallel customer audit store is introduced.

## Validation

The Phase 0 golden regression now covers:

- customer creation
- phone-based deduplication
- customer search
- order/customer relational linking
- migration 8
- migration idempotency

Phase 10.3 authorization regression remains green.

## Explicit non-goals

Do not build yet:

- full CRM
- customer segmentation
- loyalty points
- marketing automation
- customer merge UI
- external CRM integrations
- accounting ledger
- separate B2B customer database

Those can be introduced later if validated by real requirements.
