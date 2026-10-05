# Sellify Frontend ↔ Backend Gap Implementation Roadmap

Status: CURRENT
Branch: main
Date: 2026-10-02

## 1. Goal

Close the remaining frontend/backend integration gaps without rebuilding completed backend domains or introducing competing authorities.

## 2. Execution rules

For every work item:
1. Inspect current main source.
2. Identify the existing canonical API and authority.
3. Inspect existing frontend modules before creating new ones.
4. Implement the smallest compatible change.
5. Add focused regression coverage.
6. Add/maintain CI gates.
7. Re-read changed source after commit.
8. Record runtime CI evidence separately from source verification.

Never rewrite a completed domain because a historical document describes it as missing.

## 3. Roadmap

### PF-1 — Payment frontend operationalization
Status: HARDENED / SOURCE-CERTIFIED — runtime CI evidence pending

Objective:
Create the dedicated frontend contract around the existing Payment Core.

Target:
app/src/payments/client.js
app/src/payments/contract.js
app/src/payments/state.js
app/src/payments/ui.js

Required inspection:
- payment routes;
- Payment Core commands;
- payment accounts;
- payment intents;
- evidence/verification;
- order linkage;
- authorization;
- existing payment-proof module;
- existing error conventions;
- package/CI test patterns.

Requirements:
- canonical API only;
- tenant/session-aware requests;
- Idempotency-Key for mutations;
- backend state projection;
- no client ledger;
- no credentials;
- explicit 400/401/403/404/409/422/5xx handling.

Exit criteria:
- frontend can consume canonical payment state;
- payment commands map to real backend routes;
- no invented route;
- focused frontend contract regression exists;
- CI gate exists.

### PF-2 — Payment frontend adversarial certification
Status: IN PROGRESS

Required cases:
- duplicate command;
- conflicting idempotency key;
- cross-tenant access;
- unauthorized actor;
- stale evidence;
- wrong amount/currency;
- duplicate provider reference;
- expired payment;
- provider timeout;
- worker retry;
- replayed webhook;
- partial payment;
- ledger non-mutation from frontend.

Exit criteria:
- adversarial regression;
- contract/invariant certification;
- CI gate;
- source verification.

### STF-1 — Seller storefront/channel refinement
Status: PARTIAL

Use existing FUX-27/FUX-28/FUX-30/FUX-55 work as source material.

Focus:
- management UX;
- cross-channel consistency visibility;
- configuration clarity;
- tenant/channel scope;
- error and empty states.

Do not create a second storefront authority.

### CMP-1 — Compliance/Audit operational refinement
Status: PARTIAL

Use existing compliance/audit frontend authority and regressions.

Focus:
- operational views;
- evidence/decision/audit lineage visibility;
- filtering and tenant scope;
- actionable status presentation.

Do not move compliance or audit authority into UI.

### IAM-1 — Contextual authorization refinement
Status: PARTIAL

Base membership role changes are already implemented.

Focus:
- domain contextual roles;
- pack/capability composition;
- location/resource scope;
- server-side enforcement;
- audit lineage.

Preferred composition:
Identity → Membership → Base Role → Contextual Capability → Scoped Domain Role → Permission → Resource Scope → Enforcement → Audit.

### LOG-3 — Rich dispatch UX
Status: PARTIAL / PRODUCT REFINEMENT

GAP-2 authority is complete.

Focus:
- workload visibility;
- assignment/balancing controls;
- courier operational views;
- exception/recovery presentation;
- route/tracking projection.

Do not create a second routing or delivery authority.

### REL-1 — Final release certification
Status: VERIFICATION GAP

Verify:
- Node >=24;
- package scripts;
- CI gates;
- migrations;
- backup/rollback;
- regression inventory;
- GitHub workflow execution.

Where workflow runs are unavailable, state that explicitly rather than claiming CI passed.

### PACK-1 — Pack lifecycle
Status: DEFERRED

Re-evaluate only after active integration gaps and release certification are complete.

## 4. Dependency graph

PF-1 → PF-2 → REL-1
STF-1 ───────────┐
CMP-1 ───────────┤
IAM-1 ────────────┼→ REL-1
LOG-3 ───────────┘
REL-1 → PACK-1 re-evaluation

## 5. Definition of done

A gap is complete only when:
- canonical backend authority is identified;
- frontend contract is connected to that authority;
- authorization and tenant scope are server-enforced;
- mutations are idempotent where required;
- concurrency semantics are explicit where state races are possible;
- audit/event lineage is preserved;
- regression coverage exists;
- CI gate is wired;
- source is re-verified;
- runtime CI evidence is recorded if available.

## 6. Forbidden shortcuts

- rebuilding marketplace checkout;
- creating a frontend payment ledger;
- direct provider-to-database financial mutation;
- frontend-only authorization;
- bypassing delivery assignment/lifecycle authority;
- creating parallel settlement/inventory/payment authorities;
- inventing backend routes;
- importing unrelated Cheki application infrastructure;
- reopening deferred Pack lifecycle without prerequisites.
