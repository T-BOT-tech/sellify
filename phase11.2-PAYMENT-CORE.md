# Phase 11.2 — Payment Core

## Scope

This increment establishes the canonical payment boundary without replacing the existing Sellify checkout/payment-proof behavior. The roadmap defines the Payment Core as payment, ledger, reconciliation, and state concerns, with provider/channel adapters separated from the core.

## Canonical model

```text
PaymentAccount
      ↓
Payment
 ┌────┼──────────────┐
 ↓    ↓              ↓
State Ledger   Reconciliation
```

Payment states are:

```text
UNPAID → CLAIMED → RECEIVED → VERIFIED → RECONCILED
```

Failure/terminal states include:

```text
REJECTED
DUPLICATE
MISMATCH
EXPIRED
PARTIAL
REFUNDED
```

All monetary amounts are integer minor units with explicit organization currency, continuing Phase 11.1.

## Migration 13

Adds:

- `payment_accounts` — organization-scoped provider/account identity.
- `payments` — canonical payment identity, amount, currency, order/customer/account links, provider/channel metadata, state and lifecycle timestamps.
- `payment_ledger_entries` — append-only payment lifecycle history.
- `payment_reconciliations` — reconciliation attempts and match/mismatch results.

Database triggers prevent update/delete of payment ledger history.

## Compatibility bridge

Existing order fields remain authoritative for the current order UI:

- `payment_method_id`
- `payment_method_name`
- `cash_tendered`
- `change_due`
- `payment_proof`

When an order is synchronized to the server, a canonical payment projection is created from those existing fields. This is deliberately a projection, not a rewrite of the order contract.

Projection rules:

- cash tendered >= order total → `RECEIVED`;
- positive cash tendered below order total → `PARTIAL`;
- payment proof present without cash tender → `CLAIMED`;
- otherwise → `UNPAID`.

## API

```text
GET    /tenants/:chatId/payments/accounts
POST   /tenants/:chatId/payments/accounts
GET    /tenants/:chatId/payments
POST   /tenants/:chatId/payments
GET    /tenants/:chatId/payments/:paymentId
PATCH  /tenants/:chatId/payments/:paymentId
GET    /tenants/:chatId/payments/:paymentId/ledger
POST   /tenants/:chatId/payments/:paymentId/reconcile
```

Authorization uses the existing central policy:

- `payments:view` for reads;
- `payments:accept` for creating accepted payment records;
- `payments:manage` for payment-account management and state changes;
- `payments:reconcile` for reconciliation.

## Intentionally deferred

Provider implementations such as Telebirr/CBE/M-Pesa, provider registries, SMS parsers, API verification, initiation, status polling, and refund adapters are not implemented in this increment. The stable core boundary is established first, as required by the roadmap's provider-neutral architecture.

## Provider / Channel boundary

The Payment Core now exposes a provider-neutral adapter registry without
introducing live third-party integrations.

Provider contract:

```text
getMetadata()
validateAccount()
parseConfirmation()
verify()
initiate()
getStatus()
refund()
reconcile()
```

Registered provider identities are:

```text
manual
telebirr
cbe
mpesa
```

`manual` has local verification/reconciliation behavior. `telebirr`, `cbe`
and `mpesa` are registered as explicit, currently unconfigured adapters;
execution methods fail closed with `PAYMENT_PROVIDER_NOT_CONFIGURED` rather
than pretending that a network integration exists.

Channels are separately registered:

```text
manual
sms
api
```

This preserves the distinction between **who moves/verifies money** (provider)
and **how the payment entered Sellify** (channel).

Provider adapters do not write the payment database directly. The Payment
Core remains responsible for payment state, ledger entries and reconciliation.

A read-only metadata endpoint is available at:

```text
GET /tenants/:chatId/payments/providers
```

It returns the registered provider and channel capabilities and uses the
existing `payments:view` authorization policy.
