# AI HANDOFF — Sellify GAP-1 Payment Core

## Mission

Implement GAP-1 in the existing Sellify repository without breaking existing Payment Core behavior.

The objective is not to build a new payment system from scratch. The objective is to:

1. preserve the existing canonical Payment Core;
2. harden it;
3. connect external receipt verification/reconciliation;
4. add the dedicated frontend payment contract;
5. include M-Pesa in the provider plan;
6. preserve a future standalone Payment API/service seam.

## Repository

Repository:
`T-BOT-tech/sellify`

Branch:
`main`

Treat live code as authoritative over stale evaluation documents.

## Mandatory architecture

One Payment Core. Multiple surfaces. Multiple adapters. One financial authority.

The architecture is:

```
Surface
 -> canonical payment contract
 -> Payment Core
 -> reconciliation/provider adapters
 -> invariant gate
 -> payment transition
 -> append-only ledger
 -> audit/outbox
```

## Existing live facts

The repository already has:
- `backend/lib/store-sqlite.js` payment authority
- tenant-scoped payment routes
- payment accounts
- payment ledger
- provider registry
- channel registry
- outbound payment flows
- settlement flows
- payment authorization
- append-only `payment_ledger_entries`

Current internal payment states:

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

DO NOT replace these states because a prototype document uses different names.

Current provider IDs include:
- manual
- telebirr
- cbe
- mpesa

Current channels include:
- manual
- sms
- api

There is currently no dedicated `app/src/payments/` module.

## Source material already studied

The implementation must respect the previously studied:
- Cheki Extrusion Specification
- Implementation Workflow
- Architectural Addendum
- Payment Prototype PDF
- `cheki-main` source archive

Important source-derived constraints:
- Cheki is verification/reconciliation infrastructure, not financial authority.
- Payment UX is not payment authority.
- Customer-submitted references/SMS/URLs/QR/images are untrusted evidence.
- Initial documented parser extraction scope is CBE, Telebirr and BOA.
- Do not silently import all parser families found in the source archive.
- Backend routes must not be invented when capability is missing.
- Provider verification must pass invariant checks before ledger settlement.
- Adversarial testing is mandatory.

## Primary implementation order

### Step 1 — inspect before modifying

Inspect:
- current payment schema/migrations
- payment functions in `backend/lib/store-sqlite.js`
- payment route handlers in `backend/server.js`
- provider registry
- channel registry
- payment authorization
- ledger triggers/functions
- existing payment tests/regressions
- package scripts and CI workflows

Record actual contracts before editing.

### Step 2 — PaymentAccount contract

Confirm the existing schema and API support:

```
id
organization_id
provider_id
account_identifier
phone
currency
status
display_name
configuration/credential reference
timestamps
```

Do not use phone as primary payment identity.

A merchant must be able to have multiple accounts:
- Telebirr
- CBE
- M-Pesa
- BOA

### Step 3 — idempotent payment commands

Harden payment-changing commands.

At minimum distinguish:
- API command idempotency
- evidence idempotency
- provider transaction uniqueness

A retry must return the original outcome rather than create another payment/ledger result.

### Step 4 — normalized verification contract

Create a provider-neutral VerificationResult contract.

It should contain enough information to verify:
- provider
- PaymentAccount
- reference/transaction ID
- amount
- currency
- receiver
- provider timestamp
- evidence
- reason
- verification time

Provider-specific raw data must remain adapter-specific.

### Step 5 — Cheki extraction

Extract only the reusable infrastructure required by the approved initial scope.

Target conceptual namespace:

```
backend/lib/reconciliation/
  core/
  manifest/
  parsers/
  adapters/
```

Do not copy Cheki UI/Next.js/Vercel application infrastructure.

Do not let Cheki code write Sellify payment tables.

Do not let Cheki decide payment settlement.

### Step 6 — provider adapters

Initial plan:
- Telebirr
- CBE
- M-Pesa
- BOA

But implement only capabilities that are actually supported and verified.

Adapter contract may include:
- getMetadata
- validateAccount
- parseConfirmation
- verify
- initiate
- getStatus
- refund
- reconcile
- webhook

Capability flags must accurately describe implementation.

### Step 7 — reconciliation

Target:

```
Evidence
 -> Provider Adapter
 -> VerificationResult
 -> Payment Core invariant gate
 -> payment state transition
 -> ledger
```

For asynchronous reconciliation:

```
Payment/evidence
 -> job
 -> provider verification
 -> invariant gate
 -> Payment Core
 -> ledger
 -> event
```

Retries must be idempotent.

### Step 8 — frontend

Create:

```
app/src/payments/
├── client.js
├── contract.js
├── state.js
└── ui.js
```

Rules:
- no localStorage payment ledger
- no client-side settlement authority
- use canonical backend contracts
- idempotency headers for mutating commands
- distinguish 400/401/403/404/409/422/5xx
- project backend state directly
- never expose credentials

### Step 9 — adversarial tests

Required cases:
- duplicate command
- conflicting idempotency key
- duplicate evidence
- duplicate provider reference
- wrong amount
- wrong currency
- wrong receiving account
- wrong organization
- cross-tenant access
- expired payment
- unauthorized actor
- provider timeout
- worker retry
- concurrent reconciliation
- replayed webhook
- partial payment
- ledger atomicity

### Step 10 — CI/release

Add focused regressions and wire them into existing CI/release certification.

Never weaken or remove existing tests merely because an architecture change invalidates a stale assertion.

Align tests with actual canonical authority.

## Coding rules

1. Read before writing.
2. Prefer small commits.
3. Preserve existing behavior unless the contract explicitly changes.
4. Do not create duplicate authorities.
5. Do not invent routes.
6. Do not move the ledger into adapters.
7. Do not expose secrets.
8. Do not silently import unrelated Cheki functionality.
9. Keep organization isolation explicit.
10. Keep authorization server-side.
11. Make operations idempotent.
12. Add regression tests with every authority-changing implementation.
13. Keep documentation synchronized with code.

## Commit strategy

Prefer logical commits such as:

```
feat: harden payment command idempotency
feat: add normalized payment verification contract
feat: extract Cheki reconciliation boundary
feat: add Telebirr verification adapter
feat: add CBE verification adapter
feat: add M-Pesa provider adapter
feat: add BOA verification adapter
feat: add reconciliation worker boundary
feat: add payment frontend contract
test: add GAP-1 adversarial regressions
docs: certify GAP-1 payment integration
```

Do not combine unrelated changes.

## Stop conditions

Stop and report instead of guessing when:
- a required backend capability does not exist;
- a schema conflicts with the proposed contract;
- Cheki source behavior contradicts the supplied extraction specification;
- provider behavior cannot be verified;
- a transition would bypass the ledger;
- authorization semantics are unclear;
- an implementation would create a second financial authority.

Use the explicit phrase:

```
BACKEND CAPABILITY MISSING
```

when applicable.

## Definition of success

A successful implementation has:

```
Payment UI
   ↓
Canonical Payment API
   ↓
Authorization
   ↓
Payment Core
   ↓
Provider/Reconciliation Adapter
   ↓
Invariant Gate
   ↓
Canonical Payment State
   ↓
Append-only Ledger
   ↓
Audit/Event Outbox
```

and never:

```
Frontend → provider → ledger
Frontend → Cheki → settled
Provider adapter → database
SMS → merchant by phone number alone
```

## Future productization requirement

Do not implement a separate payment service now.

Instead make the internal contracts service-ready.

Future:

```
Sellify ───────────────┐
Partner App ──────────┤
Mobile SDK ───────────┤
External Merchant ────┤
                      ▼
              Payment API
                      ▼
               SAME CORE
                      ▼
               SAME LEDGER
```

External API credentials must eventually be scoped, revocable, rotatable and auditable.

## Final handoff report

At completion, report:
- files changed
- migrations added
- routes added/changed
- provider capabilities implemented
- Cheki components extracted
- PaymentAccount behavior
- state transitions
- idempotency guarantees
- reconciliation worker behavior
- frontend integration
- security/adversarial tests
- CI results
- release certification
- known limitations
- explicit future work

Do not claim production readiness merely because unit tests pass.
