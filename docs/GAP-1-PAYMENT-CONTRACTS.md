# GAP-1 — Canonical Payment Contracts

**Status:** Design contract for implementation  
**Date:** 2026-09-29

## 1. Contract hierarchy

```
PaymentAccount
     ↑
PaymentIntent
     ↑
PaymentEvidence
     ↓
VerificationResult
     ↓
PaymentDecision
     ↓
Payment State
     ↓
Ledger Entry
```

Channels and providers are orthogonal:

```
Channel → Evidence
Provider → Verification
Payment Core → Decision
```

## 2. PaymentAccount

Canonical identity for a merchant receiving account.

```
{
  id,
  organizationId,
  providerId,
  accountIdentifier,
  phone,
  currency,
  status,
  displayName,
  configuration,
  createdAt,
  updatedAt
}
```

Rules:
- id is canonical identity.
- organizationId is authoritative ownership.
- providerId identifies the provider adapter.
- accountIdentifier is provider-specific.
- phone is optional metadata/routing evidence.
- credentials must be references, not exposed secrets.
- status must be checked before routing/verification.

## 3. PaymentIntent

Represents expected payment.

```
{
  id,
  organizationId,
  orderId,
  customerId,
  paymentAccountId,
  providerId,
  amount,
  currency,
  status,
  expiresAt,
  metadata,
  createdAt,
  updatedAt
}
```

The exact existing database representation must be inspected before migration.

## 4. PaymentEvidence

Untrusted input.

```
{
  id,
  organizationId,
  channelId,
  channelType,
  providerHint,
  paymentAccountHint,
  externalReference,
  amount,
  currency,
  sender,
  receiver,
  occurredAt,
  evidenceType,
  normalizedPayload,
  receivedAt,
  fingerprint
}
```

Evidence must never directly change authoritative financial state.

## 5. VerificationResult

Normalized adapter output.

```
{
  verificationId,
  providerId,
  paymentAccountId,
  externalReference,
  verified,
  amount,
  currency,
  sender,
  receiver,
  providerTransactionId,
  providerTimestamp,
  evidenceId,
  reasonCode,
  providerPayloadHash,
  verifiedAt
}
```

Provider-specific fields may exist outside the canonical financial fields.

## 6. PaymentDecision

```
{
  paymentId,
  decision,
  previousState,
  nextState,
  verificationId,
  matchedIntent,
  matchedAccount,
  reasonCode,
  decidedAt
}
```

Decision values:
- ACCEPT
- REJECT
- MISMATCH
- DUPLICATE
- EXPIRED
- PARTIAL
- REQUIRES_REVIEW

Map decisions to existing Sellify payment states rather than replacing the existing state machine.

## 7. ProviderAdapter

Required semantic contract:

```
{
  id,
  name,
  version,
  capabilities,
  getMetadata,
  validateAccount,
  parseConfirmation,
  verify,
  initiate,
  getStatus,
  refund,
  reconcile,
  handleWebhook
}
```

The implementation may use the existing registry shape. Do not break current consumers unnecessarily.

## 8. Channel

A channel describes how information entered the system.

Initial:
- manual
- sms
- api

Future:
- webhook
- QR
- URL
- image
- provider API

Channel output is evidence or a normalized command, not a settlement.

## 9. Invariant gate

Minimum checks:
- organization
- provider
- PaymentAccount
- amount
- currency
- external reference
- provider transaction uniqueness
- expiration
- authorization
- idempotency
- ledger atomicity

## 10. Public contract rule

Future public API contracts must be versioned independently from database migrations.

Possible future resources:
- payment-intents
- payments
- payment-accounts
- providers
- reconciliation
- refunds
- webhooks

These are future design targets, not immediate implementation requirements.

## 11. Versioning

Version independently:
- provider adapter contract
- verification result
- payment command
- webhook event
- public API

Do not make database migration versions the only compatibility mechanism.


## 12. Evidence parser boundary

Cheki-derived parser concepts are observation infrastructure only.

Raw channel input -> Evidence Parser -> Parsed Evidence -> PaymentEvidence -> Provider Verification -> VerificationResult -> PaymentCore

Parser responsibilities:
- identify and parse provider-specific evidence;
- normalize reference, transaction ID, amount, currency, sender/receiver and timestamp where available;
- preserve provider payload for audit;
- return structured extraction errors;
- remain stateless with respect to payment lifecycle.

Parser prohibitions:
- no payment-state mutation;
- no ledger writes;
- no merchant-account authorization;
- no settlement/reconciliation decisions;
- no direct database access.

Provider manifests describe parser and endpoint requirements only. They are configuration metadata, not payment authority.
