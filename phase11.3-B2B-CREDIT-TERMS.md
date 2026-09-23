# Phase 11.3 — B2B Credit Terms

## Scope

This increment adds a canonical credit-terms contract for Business Customers after PO Approval and before Accounts Receivable.

The implementation is additive. Existing orders, payments, legacy B2B accounts, pricing tiers, quotes, and purchase orders remain intact.

## Migration 17

`customer_credit_terms` stores:

- organization
- business customer
- integer credit limit in minor units
- explicit currency
- payment due days (0–365)
- PO requirement
- effective dates
- status
- approval/suspension metadata
- notes/reason

Credit terms are unique per organization/customer.

## State machine

```text
PENDING
  ├── APPROVED
  ├── REJECTED
  └── CANCELLED

APPROVED
  ├── SUSPENDED
  ├── EXPIRED
  └── CANCELLED

SUSPENDED
  ├── APPROVED
  └── CANCELLED
```

Terminal states cannot transition again.

Only `PENDING` terms can be edited. Approval/suspension transitions are protected by the central authorization layer.

## API

```text
GET   /tenants/:chatId/b2b/credit-terms
POST  /tenants/:chatId/b2b/credit-terms
GET   /tenants/:chatId/b2b/credit-terms/:creditId
PATCH /tenants/:chatId/b2b/credit-terms/:creditId
```

Permissions:

```text
b2b:credit:view
b2b:credit:create
b2b:credit:manage
b2b:credit:approve
```

## Safety boundaries

- only active Business Customers may receive credit terms
- credit limit must be a non-negative integer minor amount
- payment due days are bounded to 0–365
- credit currency must match the organization's canonical currency
- credit terms do not create receivables
- credit terms do not modify existing Orders or Payments
- approved terms do not silently authorize debt creation

## UI

The existing B2B Accounts screen now exposes Credit Terms with:

- business-customer selection
- credit-limit input
- payment-due-days input
- PO-required flag
- approval/rejection controls
- suspension control
- refresh/listing

## Regression

`npm run phase11.3:credit-test`

The regression covers migration 17, Business Customer enforcement, currency and numeric validation, pending edits, approval, suspension/re-approval, invalid transitions, listing, and authorization.
