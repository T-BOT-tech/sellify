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

The B2B Accounts workspace now exposes the canonical Quotes API through app/src/b2b/quotes.js: business-customer/product selection, quote creation, server-returned quote projection, refresh, and lifecycle transitions are connected. No quote records are persisted locally.

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


## Implemented frontend surface

- app/src/b2b/quotes.js is the only frontend quote command/read surface.
- GET loads canonical quotes.
- POST creates a DRAFT quote through the backend.
- PATCH requests lifecycle transitions.
- The Accounts workspace renders quote status, number, customer reference, items, totals, notes, and available server-authorized actions.
- Frontend permission vocabulary mirrors b2b:quotes:view and b2b:quotes:manage.
- FUX-53 regression now checks the real API paths and absence of a local quote ledger.

## Evidence status

Source integration is implemented and regression coverage is committed. GitHub Actions certification for the latest FUX-53 integration commits must still be observed before marking the increment CI-certified.
