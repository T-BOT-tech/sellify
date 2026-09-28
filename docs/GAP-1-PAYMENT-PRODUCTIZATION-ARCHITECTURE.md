# GAP-1 — Future-Proof Payment Core & Productization Architecture

## Purpose
Make the Payment Core the canonical financial authority for Sellify while keeping it modular enough to become an independently consumable payment infrastructure product later.

## Core principle
One Payment Core. Multiple surfaces. Multiple adapters. One financial authority.

Target:
Consumer surface → Payment API contract → Payment Core → ledger/reconciliation/provider adapters.

## Five boundaries
### 1. Payment Core
Owns payment intent, state machine, amount/currency invariants, merchant ownership, idempotency, authorization integration, ledger transaction, settlement, refund state, audit and reconciliation decisions.

### 2. Provider Adapter
Owns provider-specific APIs, credentials, request/response translation, receipt parsing, verification, webhook normalization and provider capabilities.
It must not own Sellify payment state, persistence, ledger, authorization or settlement.

### 3. Reconciliation Engine
Generic flow: evidence → provider adapter → normalized verification result → invariant gate → Payment Core decision.

### 4. Ledger
Immutable financial history. Provider adapters never write it directly.

### 5. API/SDK surface
External consumers eventually receive stable provider-neutral commands and projections. This layer delegates to the same Payment Core.

## Cheki boundary
Cheki should be extracted as verification/reconciliation infrastructure, not as a replacement Payment Core.
Cheki produces a normalized observation such as provider, reference, amount, currency, receiver and execution time. That observation is not itself a settlement command.

## Keep these concepts separate
Payment Intent = what the merchant/application expects.
Payment Evidence = what the customer/provider claims happened.
Verification Result = what the provider adapter verified.
Payment Decision = what Payment Core decides.
Ledger Result = what becomes financially authoritative.

## Capability-driven providers
Providers should advertise capabilities such as verify, initiate, getStatus, refund, reconcile and webhook.
A receipt-verification adapter must not be presented as a full payment gateway.

## Future evidence model
Support evidence types such as reference, SMS, URL, QR, image, webhook and provider API without making any of them authoritative by themselves.

## Async reconciliation
Payment intent → reconciliation job → adapter → verification result → invariant gate → payment transition → ledger → outbox event.
Workers must be retryable, idempotent, observable, timeout-aware and provider-rate-limit-aware.

## Future independent Payment Service
Do not split the service prematurely. First establish stable internal contracts. Later, if justified by scale/business requirements, expose a versioned public API/SDK over the same Payment Core.

Conceptual future surfaces may include payment intents, payments, methods, providers, webhooks, reconciliation and refunds. These are design targets, not immediate routes.

## External credentials
Future external consumers need scoped, revocable, rotatable and auditable API credentials. Internal Sellify session tokens must not become public API credentials.

## Webhooks
Provider → signature verification → idempotency → normalized provider event → Payment Core.
Provider-specific signature verification belongs in the adapter; financial settlement remains Payment Core authority.

## Organization identity
Sellify already has organization IDs inside Payment Core. This is the correct future service identity boundary. chatId may remain a compatibility/request-routing identifier, but should not become the standalone payment product's canonical identity.

## Observability
Future payment operations should correlate request ID, payment intent ID, provider request/reference, evidence ID, verification ID, state-transition ID, ledger entry ID and audit/event ID.

## Versioning
Version public API, provider adapter contracts, verification results, payment commands and webhook events independently from database migrations.

## Multi-currency
Future multi-currency support should preserve immutable source currency/amount, target currency/amount, locked FX rate and quote expiry.

## Regulatory boundary
The supplied architecture documents describe closed-loop credit, trade payables, escrow and float. Any future independent payment product involving regulated money movement, custody or wallet functionality requires dedicated legal/regulatory review before launch.

## Definition of future-proof
Adding a provider should require a provider adapter, configuration and tests—not rewriting Payment Core, ledger, tenant model or settlement engine.
Adding a new consumer surface should require a new API/SDK adapter—not a new financial authority.

## Immediate GAP-1 rule
Build the current Sellify frontend and Cheki reconciliation integration, but preserve the seams for future extraction: canonical provider adapter, normalized verification result, reconciliation worker boundary, idempotent payment commands, provider capability discovery, organization isolation, immutable ledger, audit/event correlation and a future public API seam.