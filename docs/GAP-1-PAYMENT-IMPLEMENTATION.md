# GAP-1 — Payment Core Implementation Specification

**Status:** Architecture locked; implementation pending  
**Date:** 2026-09-29  
**Scope:** Sellify Payment Core, provider/reconciliation integration, frontend payment contract, Cheki-derived verification, and future productization seams.

## 1. Purpose

GAP-1 closes the payment authority gap between Sellify's existing backend Payment Core and the operational frontend while adding safe external receipt reconciliation and preserving a future path to an independently consumable Payment API/service.

The implementation must preserve the existing Sellify financial authority. Do not replace the current payment state machine, ledger, organization model, authorization model, or provider registry merely to match prototype documents.

## 2. Non-negotiable architecture

**One Payment Core. Multiple surfaces. Multiple adapters. One financial authority.**

```
Sellify PWA/Web/Telegram/Future API
                |
                v
      Canonical Payment Contract
                |
                v
          PAYMENT CORE
                |
       +--------+---------+
       |                  |
       v                  v
 PaymentAccount     Reconciliation
       |                  |
       |                  v
       |            Provider Adapter
       |                  |
       |         +--------+--------+
       |         |        |        |
       |      Telebirr   CBE     M-Pesa/BOA
       |                  |
       +--------+---------+
                |
          Invariant Gate
                |
             Ledger
                |
          Audit / Outbox
```

Payment Core owns:
- payment state transitions
- amount/currency invariants
- organization ownership
- idempotency
- authorization integration
- reconciliation decisions
- settlement/refund decisions
- ledger writes
- audit/event authority

Provider adapters own:
- provider-specific API calls
- provider-specific receipt parsing
- provider verification
- provider webhook normalization
- provider capability declaration
- provider credential handling through secure references

Provider adapters MUST NOT own:
- payment persistence
- ledger writes
- authorization decisions
- tenant/organization authority
- settlement decisions
- event persistence

## 3. Existing live authority

The live repository already has:
- provider metadata endpoint
- payment-account endpoints
- inbound payment creation/list/detail/transition endpoints
- payment ledger endpoint
- manual reconciliation endpoint
- outbound payment flows
- settlement flows
- provider registry
- channel registry
- append-only `payment_ledger_entries`

Current canonical internal states:

```
UNPAID
CLAIMED
RECEIVED
VERIFIED
RECONCILED
REJECTED
DUPLICATE
MISMATCH
EXPIRED
PARTIAL
REFUNDED
```

Do not replace these with simplified prototype states such as SETTLED or PENDING_RECONCILIATION. Public projections may normalize them later.

## 4. Provider plan

Initial provider plan:
1. Telebirr
2. CBE
3. M-Pesa
4. BOA

M-Pesa is explicitly part of GAP-1.

The architecture must allow future providers such as Chapa, EthSwitch, MTN MoMo, Flutterwave, DPO Pay, or other supported providers without Payment Core rewrites. Future provider inclusion is architectural readiness, not permission to implement unsupported integrations now.

Current live registry already contains:
- manual
- telebirr
- cbe
- mpesa

Telebirr/CBE/M-Pesa are currently unconfigured adapters. BOA must be added through the same provider contract when its implementation slice is approved.

## 5. Provider versus channel

These are separate dimensions.

**Channel = how evidence/command entered Sellify.**

Current channels:
- manual
- sms
- api

Future channels may include:
- webhook
- QR
- URL
- image/document
- provider API

**Provider = who moved or verified money.**

Example:

```
SMS + Telebirr
API + Telebirr
Webhook + Telebirr
Manual + Telebirr
SMS + M-Pesa
API + M-Pesa
```

Do not create provider-channel-specific implementations such as `telebirr-sms.js`.

## 6. PaymentAccount

PaymentAccount is the canonical routing identity for a merchant receiving account.

Conceptual model:

```
PaymentAccount
- id
- organization_id
- provider_id
- account_identifier
- phone
- currency
- status
- display_name
- configuration/credential references
- created_at
- updated_at
```

Rules:
- `id` is the canonical identity.
- Phone is an attribute, not merchant identity.
- Account identifiers are provider-specific.
- One organization may own multiple accounts for the same provider.
- One organization may own accounts across Telebirr, CBE, M-Pesa and BOA.
- Raw provider secrets must never be returned to frontend consumers.
- `chatId` is a Sellify routing/compatibility identifier, not the future standalone Payment Service's canonical identity.

Resolution target:

```
Channel
 -> Provider detection
 -> PaymentAccount resolution
 -> Organization
 -> PaymentIntent matching
```

## 7. PaymentIntent

A PaymentIntent represents what the application expects to receive.

Conceptual fields:
- id
- organization_id
- order_id/customer_id where applicable
- payment_account_id
- provider_id
- amount
- currency
- status
- expires_at
- idempotency reference
- metadata
- timestamps

The intent is not proof of receipt.

## 8. Evidence model

All untrusted incoming payment claims must be represented as PaymentEvidence before financial authority is affected.

Evidence types:
- reference
- SMS
- URL
- QR
- image
- manual
- webhook
- provider API

Conceptual fields:
- evidence_id
- organization_id
- channel_id/type
- provider_hint
- payment_account_hint
- external_reference
- amount
- currency
- sender
- receiver
- occurred_at
- evidence_type
- normalized_payload
- received_at
- fingerprint

Evidence is never authoritative.

## 9. VerificationResult

Provider adapters normalize provider observations into a provider-neutral VerificationResult.

Required semantic fields:
- verification_id
- provider_id
- payment_account_id
- external_reference
- verified
- amount
- currency
- sender/receiver when available
- provider_transaction_id
- provider_timestamp
- evidence_id
- reason_code
- provider_payload_hash
- verified_at

The adapter may return provider-specific metadata, but Payment Core must rely only on the normalized contract for financial decisions.

## 10. Payment decision

Payment Core consumes VerificationResult and makes the authoritative decision.

Possible decision classes:
- ACCEPT
- REJECT
- MISMATCH
- DUPLICATE
- EXPIRED
- PARTIAL
- REQUIRES_REVIEW

The decision must be persisted through the existing payment state transition mechanism and ledger path.

## 11. Invariant gate

A verified provider observation may transition a payment only after the invariant gate confirms:

1. organization ownership matches
2. provider matches expected provider
3. payment account belongs to the organization
4. receiving account matches the intended account where required
5. amount matches the payment intent, subject to explicit partial/overpayment policy
6. currency matches
7. external reference is unique/idempotently handled
8. provider transaction is not already consumed
9. payment intent is still eligible/not expired
10. evidence is not replayed
11. authorization permits the operation
12. ledger transition is atomic with the authoritative state change

Never let a provider adapter bypass this gate.

## 12. Idempotency

Implement three protections:

### API command idempotency
Payment-changing commands require `Idempotency-Key` or equivalent existing contract.

Same key + same semantic request:
- return the original result.

Same key + conflicting semantic request:
- return conflict.

### Evidence idempotency
Use a stable evidence fingerprint where possible.

### Provider transaction uniqueness
A provider transaction/reference must not settle multiple payments.

A retry must never create a second financial settlement.

## 13. Cheki extraction boundary

Cheki is verification/reconciliation infrastructure.

Extract only reusable verification components required for initial Sellify scope:
- core Result/error abstractions
- receipt types
- parser interfaces/base parser
- bank manifest data
- verifier/orchestration concepts
- initial live parser families required by the approved scope

Initial parser scope from the supplied architecture documents:
- CBE
- Telebirr
- BOA

Do not silently import every parser present in the Cheki source archive. The source archive contains more provider families than the documented initial extraction scope.

Cheki-derived code must be isolated under a Sellify reconciliation namespace and must not own payment persistence or ledger behavior.

Target flow:

```
Payment evidence
 -> Cheki-derived provider verification
 -> VerificationResult
 -> Payment Core invariant gate
 -> payment transition
 -> ledger
```

## 14. Async reconciliation worker

Target:

```
Payment/evidence
 -> reconciliation job
 -> provider adapter
 -> VerificationResult
 -> invariant gate
 -> Payment Core
 -> ledger
 -> outbox event
```

Worker requirements:
- idempotent
- retryable
- timeout-aware
- provider-rate-limit-aware
- observable
- safe under duplicate delivery
- safe under process restart
- able to surface permanent failures for review

Do not add a worker before its input/output contract is defined.

## 15. Webhook architecture

Future provider webhooks must follow:

```
Provider
 -> channel/webhook boundary
 -> signature verification inside provider adapter
 -> webhook/event idempotency
 -> normalized provider event
 -> Payment Core
 -> invariant/state transition
 -> ledger
```

Webhook payloads are not directly authoritative.

## 16. Routing policy

PaymentAccount selection should eventually support configurable policies.

Initial policy concepts:
- default payment account
- allowed accounts
- fallback accounts
- currency rules
- channel rules

Future policies may include:
- amount
- location
- customer type
- sales channel
- product
- provider availability
- provider capabilities

Do not build a general-purpose rules engine unless required.

## 17. Provider capabilities

Providers advertise capabilities rather than being assumed to support every operation.

Capability examples:
- getMetadata
- validateAccount
- parseConfirmation
- verify
- initiate
- getStatus
- refund
- reconcile
- webhook

A capability set must be authoritative for UI/API availability.

An unsupported operation should return a deterministic unsupported/not-configured result, not silently emulate it.

## 18. Frontend architecture

Create a dedicated payment frontend module only after backend contracts are confirmed:

```
app/src/payments/
├── client.js
├── contract.js
├── state.js
└── ui.js
```

Frontend rules:
- no payment persistence in localStorage
- no financial authority in browser state
- commands use canonical backend routes
- payment-changing commands use idempotency keys
- handle 400/401/403/404/409/422/5xx distinctly
- display backend state, not locally invented success
- never expose provider credentials
- payment-account configuration is backend-authoritative

## 19. Product UX

Merchant UX should hide adapter complexity.

Example:

```
Payment Methods

Telebirr
  Account: 09••••123
  Active

CBE
  Account: ••••4567
  Active

M-Pesa
  Account: 09••••890
  Active

BOA
  Not configured

Default: Telebirr
[Add payment account]
```

The merchant should configure accounts and policies, not understand parser/adapter internals.

## 20. Standalone product seam

Do not create a separate Payment Service yet.

First establish stable contracts.

Future consumer surfaces may include:
- Sellify
- partner applications
- external merchant dashboards
- mobile SDK
- web SDK
- public API

All must eventually use the same Payment Core and ledger.

Future external authentication must use:
- scoped credentials
- revocation
- rotation
- audit
- rate limits

Never expose internal Sellify session tokens as external payment API credentials.

## 21. Observability

Correlate, where applicable:
- request_id
- payment_intent_id
- payment_id
- payment_account_id
- provider_id
- provider_reference
- evidence_id
- verification_id
- transition_id
- ledger_entry_id
- audit/event_id
- reconciliation_job_id

Sensitive provider payloads must be redacted or hashed where possible.

## 22. Multi-currency readiness

Do not implement FX prematurely, but preserve room for:
- source amount/currency
- target amount/currency
- locked FX rate
- quote expiry

Never mutate historical financial amounts.

## 23. Refund readiness

Refunds must be Payment Core operations.

Provider adapters may execute provider-specific refund mechanics.

Correct boundary:

```
Payment Core refund decision
 -> provider adapter refund()
 -> normalized provider result
 -> Payment Core state transition
 -> ledger
```

Never:

```
provider adapter -> ledger
```

## 24. Regulatory boundary

Closed-loop credits, escrow, trade payables, stored value, float, custody, wallet functionality, or independent payment processing may create legal/regulatory obligations. Treat those as separate product/legal workstreams before launch.

## 25. Implementation phases

### Phase 0 — Contract freeze
- review existing payment schemas/routes
- freeze canonical state machine
- freeze PaymentAccount semantics
- freeze provider/channel separation
- freeze VerificationResult
- freeze idempotency semantics
- document all existing routes rather than inventing replacements

### Phase 1 — Payment Core hardening
- complete idempotent inbound payment creation
- enforce invariant boundaries
- confirm append-only ledger atomicity
- strengthen provider/account ownership checks
- add targeted tests

### Phase 2 — Cheki-derived reconciliation
- extract minimal reusable Cheki infrastructure
- implement initial CBE/Telebirr/BOA verification adapters
- normalize to VerificationResult
- add replay/duplicate/amount/tenant tests
- do not modify ledger directly

### Phase 3 — M-Pesa provider slice
- implement M-Pesa adapter contract
- account validation if supported
- verification/reconciliation capabilities actually supported
- provider-specific tests
- do not claim unsupported gateway/refund/webhook capabilities

### Phase 4 — Reconciliation worker
- queue/job boundary
- retry/backoff
- idempotency
- timeout handling
- observability
- permanent-failure/review path

### Phase 5 — Frontend Payment Core
- `app/src/payments/client.js`
- `contract.js`
- `state.js`
- `ui.js`
- payment accounts
- payment intake
- status projection
- reconciliation status
- error handling
- no local payment authority

### Phase 6 — Adversarial certification
Test:
- duplicate API command
- duplicate SMS
- duplicate provider reference
- amount tampering
- currency mismatch
- wrong organization
- wrong PaymentAccount
- expired intent
- unauthorized role
- cross-tenant access
- replayed webhook
- worker retry
- provider timeout
- provider rate limiting
- partial payment
- concurrent reconciliation
- ledger atomicity

### Phase 7 — Release certification
All baseline/FUX/GAP regressions must pass, plus:
- GAP-1 contract regression
- provider registry regression
- PaymentAccount isolation regression
- reconciliation adversarial regression
- frontend payment regression
- security checks
- release certification

## 26. Explicit non-goals

Do not:
- replace the existing payment state machine
- create a second ledger
- create a second Payment Core
- import every Cheki parser
- expose internal tenant routes as public payment APIs
- invent backend routes without verifying capability
- add unsupported provider operations
- store raw provider credentials in frontend/localStorage
- allow frontend-only payment success
- let provider adapters write financial state
- build a generalized rules engine prematurely
- extract a microservice prematurely

## 27. Definition of done

GAP-1 is complete only when:
- Payment Core remains the sole financial authority
- PaymentAccount is canonical routing identity
- Telebirr/CBE/M-Pesa/BOA have explicit provider contracts and accurate capabilities
- channels remain independent from providers
- Cheki-derived verification feeds normalized results only
- reconciliation is idempotent and tenant-safe
- invariant gate protects every authoritative transition
- ledger remains append-only and authoritative
- frontend uses canonical payment contracts
- no payment authority exists in local browser state
- adversarial regressions pass
- CI and release certification pass
- documentation accurately describes the implemented system
- future public Payment API can be added without creating another financial authority
