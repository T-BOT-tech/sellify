# Phase 11.3 — B2B Accounts Receivable

This increment adds a canonical, append-oriented Accounts Receivable layer after approved Credit Terms and before Invoice.

## Contract

```text
Business Customer
      ↓
Approved Credit Terms
      ↓
Approved PO / Existing Order
      ↓
Accounts Receivable
      ↓
Verified Payment Allocation
      ↓
Outstanding Balance
```

Invoice creation is intentionally deferred to the next B2B increment.

## Data model

- `accounts_receivable` — customer obligation and current outstanding balance.
- `ar_ledger_entries` — immutable charge/payment/state history.
- `ar_payment_allocations` — payment-to-receivable allocation records.

All monetary values remain integer minor units with explicit currency.

## State model

```text
OPEN → PARTIAL → PAID
OPEN → OVERDUE
PARTIAL → OVERDUE
OPEN/PARTIAL/OVERDUE → WRITTEN_OFF | CANCELLED
OVERDUE → PARTIAL | PAID | WRITTEN_OFF | CANCELLED
```

## Safety

- only Business Customers may have receivables;
- approved credit terms are required;
- organization currency must match;
- a receivable cannot be created twice for the same source;
- credit-limit usage is checked before creation;
- only VERIFIED/RECONCILED payments may be allocated;
- allocations cannot exceed the receivable outstanding amount or payment amount;
- AR ledger entries are append-only.

## API

```text
GET  /tenants/:chatId/b2b/receivables
POST /tenants/:chatId/b2b/receivables
GET  /tenants/:chatId/b2b/receivables/:id
PATCH /tenants/:chatId/b2b/receivables/:id
GET  /tenants/:chatId/b2b/receivables/:id/ledger
POST /tenants/:chatId/b2b/receivables/:id/allocate
```

Permissions:

```text
b2b:ar:view
b2b:ar:create
b2b:ar:manage
b2b:ar:allocate
```

## Compatibility

Existing Orders, Payments, Payment Core, Quotes, Purchase Orders and Credit Terms remain intact. AR consumes those contracts rather than replacing them.

## Next

Phase 11.3 Invoice should build on the receivable contract and document a billable obligation without creating a second accounting engine.
