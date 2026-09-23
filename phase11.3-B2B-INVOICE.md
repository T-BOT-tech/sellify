# Phase 11.3 — B2B Invoice

## Scope

Invoice is the final document increment in the Phase 11.3 B2B sequence:

```text
Custom Pricing
  ↓
Quotes
  ↓
PO Approval
  ↓
Credit Terms
  ↓
Accounts Receivable
  ↓
Invoice
```

This implementation is additive. It does not replace Orders, Payments, Accounts Receivable, or the existing receipt UI.

## Canonical boundary

```text
Receivable
   ↓
Invoice snapshot
   ↓
Issued document
```

An invoice references exactly one receivable. Creating or issuing an invoice does not create a second receivable.

## Data model

Migration 19 adds:

- `invoices`
- `invoice_items`

Invoice money remains integer minor units with explicit currency.

Invoice items snapshot description, quantity, unit price, line total, and currency so later catalog/pricing changes do not mutate a historical document.

## States

```text
DRAFT → ISSUED → VOID
DRAFT → CANCELLED
```

Terminal states cannot transition again.

Payment state remains represented by the underlying Accounts Receivable and Payment Core rather than introducing a second payment ledger.

## API

```text
GET   /tenants/:chatId/b2b/invoices
POST  /tenants/:chatId/b2b/invoices
GET   /tenants/:chatId/b2b/invoices/:invoiceId
PATCH /tenants/:chatId/b2b/invoices/:invoiceId
```

Permissions:

```text
b2b:invoice:view
b2b:invoice:create
b2b:invoice:manage
```

## Compatibility

Existing receipt generation under `app/src/orders/receipts.js` remains unchanged. The new Invoice document contract is for B2B/AR workflows and is not a replacement for retail receipts.

## Audit

Invoice creation and state transitions use the existing append-oriented `audit_events` infrastructure.

## Tests

`phase0/phase11.3-b2b-invoice-regression.mjs` verifies:

- invoice creation from a receivable
- money/currency snapshot
- invoice items
- issuance
- invalid state transition rejection
- duplicate invoice rejection
- migration 19
- authorization boundaries

The Phase 0 Golden Regression remains mandatory.
