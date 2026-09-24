# FUX-53 — B2B Quotes Frontend Authority Boundary

## Objective

Connect the existing B2B Quotes capability to the Sellify frontend without creating a second quote authority.

## Current state

Core B2B Quotes already has canonical persistence and transitions:

- `GET /tenants/:chatId/b2b/quotes`
- `POST /tenants/:chatId/b2b/quotes`
- `GET /tenants/:chatId/b2b/quotes/:quoteId`
- `PATCH /tenants/:chatId/b2b/quotes/:quoteId`

Authorization:

- `b2b:quotes:view`
- `b2b:quotes:manage`

The current B2B frontend exposes accounts, pricing, purchase orders, credit terms, receivables, and invoices, but does not yet expose the canonical Quotes API.

## Required authority

Target path:

`B2B Quote intent → canonical Quotes API → server authorization/validation → quotes/quote_items → audit → canonical response → UI projection`

The frontend must not create or maintain a second quote ledger in localStorage.

## Quote lifecycle

- DRAFT → SENT → ACCEPTED
- SENT → REJECTED / EXPIRED / CANCELLED
- DRAFT → CANCELLED

Terminal states must not be locally fabricated.

## Money and pricing

- Quote totals remain server-authoritative.
- Money remains integer minor units plus currency.
- Customer-specific canonical pricing may be resolved by the backend.
- Product/customer organization scope remains server-enforced.

## Offline semantics

Quote creation or transition that cannot be confirmed by the server must be represented as QUEUED/UNKNOWN through the existing command outbox. It must never be displayed as server-confirmed.

## Scope

This increment is intentionally limited to the B2B Quotes frontend authority boundary. Payment integration remains deferred.
