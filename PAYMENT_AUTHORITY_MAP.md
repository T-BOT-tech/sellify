# Sellify GAP-1 — Payment Authority Map

Status: INSPECTION COMPLETE — NO PAYMENT IMPLEMENTATION CHANGES YET
Date: 2026-09-28

## Current canonical authority
The live repository already contains a canonical Payment domain in backend/lib/store-sqlite.js.
Cheki is not the payment authority. Cheki is intended to become a provider/reconciliation verification adapter.

## Current backend capabilities
| Capability | Route | Status |
|---|---|---|
| Provider/channel metadata | GET /tenants/:chatId/payments/providers | Available |
| Payment accounts | GET/POST /tenants/:chatId/payments/accounts | Available |
| Create inbound payment | POST /tenants/:chatId/payments | Available |
| List payments | GET /tenants/:chatId/payments | Available |
| Payment detail | GET /tenants/:chatId/payments/:paymentId | Available |
| Payment transitions | PATCH /tenants/:chatId/payments/:paymentId | Available |
| Payment ledger | GET /tenants/:chatId/payments/:paymentId/ledger | Available |
| Manual reconciliation | POST /tenants/:chatId/payments/:paymentId/reconcile | Available |
| Outbound payment intents | /tenants/:chatId/payments/outbound* | Available |
| Procurement settlement | payment settlement endpoints | Available |
| Cheki receipt verification | — | BACKEND CAPABILITY MISSING |
| Async Cheki reconciliation worker | — | BACKEND CAPABILITY MISSING |
| General provider webhook contract | — | BACKEND CAPABILITY MISSING |

## Current payment state machine
UNPAID, CLAIMED, RECEIVED, VERIFIED, RECONCILED, REJECTED, DUPLICATE, MISMATCH, EXPIRED, PARTIAL, REFUNDED.

The live state machine is broader than the simplified prototype vocabulary. Do not replace it with PENDING_RECONCILIATION/SETTLED/FAILED/DISPUTED. A future public API may normalize states while preserving the internal canonical states.

## Current ledger
payment_ledger_entries is append-only through database triggers. Provider adapters must never write to it directly.

Correct boundary: provider/reconciliation adapter → normalized verification result → Payment Core invariant gate → Payment transition → append-only ledger.

## Provider architecture
Current provider IDs: manual, telebirr, cbe, mpesa.
Provider capabilities include getMetadata, validateAccount, parseConfirmation, verify, initiate, getStatus, refund, reconcile.
Telebirr, CBE and M-Pesa are currently registered as unconfigured adapters.

## Channel architecture
Current channels: manual, sms, api.
Channel means how evidence/command entered Sellify. Provider means who moved or verified money. Keep these concepts separate.

## Authorization
Manager payment permissions include payments:accept, payments:view_proof, payments:view, payments:manage, payments:reconcile, payments:settlement:view, payments:settlement:allocate. Outbound payment permissions also exist.

## Existing platformization seam
Sellify already exposes the payments.core platform capability and an adapter framework that forbids adapters from owning persistence, database, ledger, authorization, transaction authority, or event storage.

## Frontend
There is currently no dedicated app/src/payments module in the live repository. The frontend Payment Core integration therefore remains a real gap.

## Critical gaps discovered
1. Cheki verification bridge is missing.
2. Automatic external receipt reconciliation is missing; current reconcilePayment performs a database-side amount/currency comparison.
3. createPayment does not yet implement the full idempotent command contract required by GAP-1.
4. A standalone/public Payment API boundary does not yet exist; the current API is correctly tenant-scoped for Sellify.
5. A generalized provider webhook boundary was not identified.

## Future-product rule
Sellify and a future independent Payment Service must converge on one Payment Core and one financial ledger.
Do not create a Sellify ledger plus a separate payment-service ledger.

Sellify mode: Sellify UI → tenant Payment API → Payment Core.
Future service mode: external merchant/application → public Payment API/SDK → same Payment Core.

## Authority invariant
Payment UX → canonical Payment API → authorization → Payment Core → provider/reconciliation adapter → invariant gate → payment state → append-only ledger → audit/event outbox.