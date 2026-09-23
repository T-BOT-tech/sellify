# Phase 16.1 — Canonical Capability Contracts

## Status
PASS — executable capability contract implemented and regression verified.

## Purpose
Introduce the first reusable platform capability vocabulary without moving any existing authority into the platform layer.

## Implemented
- `app/src/platform/capability-contract.js`
- `phase0/phase16.1-canonical-capability-contract-regression.mjs`
- `package.json` → `test:phase16.1`

## Canonical capabilities
- `commerce.orders`
- `commerce.products`
- `inventory.stock`
- `payments.core`
- `customers.identity`
- `locations.scope`
- `fulfillment.operations`
- `documents.invoices`
- `audit.history`
- `country.configuration`
- `vertical.configuration`
- `events.versioned`

## Authority rule
The capability layer is a vocabulary and delegation boundary only:

`Consumer → Capability Contract → Existing Authority`

It does not create persistence, authorization, transaction, ledger, event-store, broker, or API-gateway authority.

Authorization continues to use `backend/lib/authorization.js`. Domain transactions remain owned by their existing aggregate/domain authorities. Event publication remains behind the existing versioned event/outbox boundary.

## Regression
- Phase 16.1: **30 PASS / 0 FAIL**
- Phase 16.0 baseline: **9 PASS / 0 FAIL**
- Phase 15.20 cross-country gate: **126 PASS / 0 FAIL**

Node runtime remains v22.16.0 in this environment; the repository engine requirement remains `>=24`. This phase does not certify Node >=24.
