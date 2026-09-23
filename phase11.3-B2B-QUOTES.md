# Phase 11.3 — B2B Workflow: Quotes

This increment adds the canonical quote workflow after Custom Pricing.

## Contract

```text
Business Customer + Product + Quantity
        ↓
Quote snapshot
        ↓
Money (minor units + currency)
        ↓
Quote state
```

Quote states:

```text
DRAFT → SENT → ACCEPTED
             ├→ REJECTED
             ├→ EXPIRED
             └→ CANCELLED
DRAFT → CANCELLED
```

Accepted/rejected/expired/cancelled quotes are terminal in this increment.
A quote does not automatically create an Order yet; that remains a later controlled bridge.

## Data model

Migration 15 adds:

- `quotes`
- `quote_items`

Quote items snapshot product description, quantity, unit price, currency, line total, and the canonical customer-pricing rule when one was used.

## API

- `GET /tenants/:chatId/b2b/quotes`
- `POST /tenants/:chatId/b2b/quotes`
- `GET /tenants/:chatId/b2b/quotes/:quoteId`
- `PATCH /tenants/:chatId/b2b/quotes/:quoteId`

PATCH is a controlled state transition endpoint using `status`/`state` and an optional `reason`.

## Authorization

- `b2b:quotes:view`
- `b2b:quotes:manage`

## Rules

- Quotes require a canonical `business` Customer.
- Products must belong to the tenant organization.
- Quote currency follows the tenant's canonical currency.
- Money is integer minor units.
- Customer-specific active pricing is used automatically when a unit price is not explicitly supplied.
- Quote totals are recomputed from quote items.
- Existing orders and legacy B2B checkout remain unchanged.
- Quote transitions are audit-recorded.

## Compatibility

The existing local B2B account/pricing/checkout behavior remains intact. Quotes are a new document/workflow boundary and are not yet the source of truth for orders.

## Regression

`npm run phase11.3:quotes-test`

The golden migration expectation is now 1–15.
