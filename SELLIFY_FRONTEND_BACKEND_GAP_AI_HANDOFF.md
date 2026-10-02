# Sellify Frontend ↔ Backend Gap AI Handoff

Status: CURRENT HANDOFF
Branch: main
Date: 2026-10-02

## 1. Mission

Continue Sellify from the live main branch.

Do not treat historical gap documents as source of truth when they conflict with live code.

The immediate implementation target is the Payment frontend boundary, not a new Payment Core.

## 2. Current authority model

Canonical application pattern:

Frontend
→ canonical contract
→ backend authority
→ authorization/scope
→ state transition
→ audit/event/outbox

Payment:

Frontend
→ Payment API
→ Payment Core
→ provider/reconciliation evidence
→ verification
→ invariant gate
→ decision
→ append-only ledger
→ audit/event/outbox

Delivery:

Order / Marketplace
→ Seller Order
→ Fulfillment
→ Delivery Assignment
→ Delivery Lifecycle
→ Proof / Exception
→ existing Inventory consequence

Payment and Settlement remain external authorities.

## 3. Completed recent hardening

GAP-1.18 Payment-Core hardening is complete through the current payment lineage/security/recovery work.

GAP-2.1–2.13 Logistics/Delivery hardening is complete, including:
- assignment authority;
- idempotency;
- lifecycle;
- courier role and ownership;
- tenant/location scope;
- exception recovery;
- workload projection;
- deterministic balancing;
- proof validation/immutability;
- route/dispatch read-only projection;
- cross-feature authority separation;
- adversarial testing;
- end-to-end certification;
- production readiness;
- source-of-truth exit.

## 4. Immediate target — PF-1

Before changing code, inspect:
- backend/lib/store-sqlite.js payment functions;
- backend/server.js payment routes;
- app/src/orders/payment-proof.js;
- app/src/config/payment-methods.js;
- app/src/country-payment-adapter-mapping.js;
- payment provider/channel registry;
- payment authorization;
- payment account/intents/evidence/verification/decision contracts;
- payment regression files;
- package.json;
- .github/workflows/ci.yml.

Then determine the exact canonical routes and response shapes from source.

Do not invent routes.

## 5. Frontend target

Create a dedicated payment frontend boundary only after source inspection:

app/src/payments/
- client.js — HTTP/API calls only.
- contract.js — canonical request/response/error contracts.
- state.js — projection of backend payment state; no financial authority.
- ui.js — presentation/controller helpers only.

Integrate with existing payment-proof functionality rather than duplicating it.

## 6. Required security properties

- active tenant/session context;
- server-side authorization;
- organization isolation;
- no credentials in browser;
- no local payment ledger;
- no frontend settlement/refund authority;
- Idempotency-Key on financial mutations;
- explicit conflict/error handling;
- no trust of client-supplied payment success.

## 7. Required adversarial coverage

At minimum:
- duplicate mutation;
- idempotency-key reuse conflict;
- cross-tenant read;
- cross-tenant mutation;
- unauthorized role;
- stale/expired payment;
- evidence mismatch;
- duplicate provider reference;
- timeout/retry;
- concurrent reconciliation;
- replayed webhook;
- partial payment;
- frontend cannot mutate ledger directly.

## 8. Regression/CI procedure

After each logical change:
1. add or update a focused phase0 regression;
2. add package script;
3. add CI gate in existing order;
4. run available source-level checks;
5. inspect resulting source;
6. commit one logical change;
7. check workflow runs;
8. if no workflow run is available, record verification as source-level only.

## 9. Existing hardening rules

Do not weaken:
- Payment Core authorization;
- evidence authority checks;
- verification freshness;
- invariant gates;
- atomic payment decisions;
- payment ledger immutability;
- provider transaction uniqueness;
- tenant binding;
- delivery lifecycle transaction boundaries;
- courier scope;
- delivery proof immutability;
- inventory/payment/settlement authority separation.

## 10. Stop conditions

Stop rather than guessing if:
- a route does not exist;
- the frontend expects a response shape not supplied by backend;
- authorization semantics are ambiguous;
- provider capability is unverified;
- a proposed change creates a competing authority;
- schema and contract disagree.

Use:
BACKEND CAPABILITY MISSING

when the required backend capability truly does not exist.

## 11. Deferred work

Pack lifecycle is intentionally deferred.

Rich dispatch UX is refinement, not missing delivery authority.

Live provider execution must only be implemented for verified capabilities.

## 12. Handoff rule

Every future AI/session must begin from live main, inspect actual code, and preserve the architecture above. Never resume from a historical gap label without reconciling it against current source.
