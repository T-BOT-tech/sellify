# Phase 17.8 — Payment Core Outbound Capability + Procurement Payment Association

## Status
IMPLEMENTED — 2026-09-11

## Scope
Phase 17.8A adds a provider-neutral outbound payment instruction capability to the existing Payment Core. Phase 17.8B associates procurement-origin approved Purchase Orders with that capability.

## Authority rule
`payments` remains the financial authority. `payment_outbound_intents` is an operational instruction table inside Payment Core; it is **not** a second financial ledger. Existing `payments` and `payment_ledger_entries` are not duplicated or mutated by this phase.

## Lifecycle
`DRAFT → INITIATED → SUBMITTED → CONFIRMED`

Failure/cancellation branches:
- DRAFT → CANCELLED
- INITIATED → FAILED/CANCELLED
- SUBMITTED → FAILED

Confirmed, failed and cancelled are terminal.

## Procurement boundary
A procurement payment intent requires an approved procurement-origin Purchase Order. Supplier organization is read from the existing PO; no Supplier or Customer identity is manufactured.

The amount must be a positive integer minor-unit amount and cannot exceed the PO total. Currency must match the PO. Provider validation reuses the existing Payment Provider Registry.

## Idempotency
The request hash covers PO, amount, currency, provider and counterparty. Reuse of the same idempotency key with the same request returns the original intent; a conflicting request fails closed.

## No external funds movement
Phase 17.8 does not invoke a provider API or claim that funds have moved. `CONFIRMED` is the provider-neutral execution boundary. Provider adapters/external transfer execution remain a later capability.

## APIs
- `GET/POST /tenants/:chatId/payments/outbound`
- `GET /tenants/:chatId/payments/outbound/:id`
- `POST /tenants/:chatId/payments/outbound/:id/{submit|confirm|fail|cancel}`
- `POST /tenants/:chatId/procurement/purchase-orders/:purchaseOrderId/payment`

## Authorization
New central permissions:
- `payments:outbound:create`
- `payments:outbound:submit`
- `payments:outbound:confirm`
- `payments:outbound:manage`
- `procurement:payment:create`

## Validation performed
- Phase 17.8 Payment Contract Regression: PASS
- Phase 17.8 Procurement Payment Regression: PASS
- Phase 17.7 Receiving Regression: PASS
- Phase 17.7 Receiving Contract Regression: PASS
- Phase 16.12 Platform Regression: PASS
- Phase 0 Golden Regression: 21 PASS / 0 FAIL
- Runtime: Node v22.16.0
- Node >=24 certification: remains deferred

## Next
Phase 17.9 should define settlement semantics only after the outbound payment contract is stable. It must not copy Marketplace settlement semantics and must distinguish payment execution confirmation from supplier settlement accounting.
