# Sellify Frontend ↔ Backend Gap Certification Matrix

Status: CURRENT CERTIFICATION BASELINE
Branch: main
Date: 2026-10-02

## Certification dimensions

Each active domain is evaluated across:
1. Backend Contract
2. Frontend Contract
3. Authorization
4. Tenant/Resource Scope
5. Idempotency
6. Concurrency
7. Audit/Event Lineage
8. Regression
9. CI Gate
10. Runtime Verification

Legend:
- C = certified in source
- P = partial/refinement
- O = open
- D = deferred
- V = verification evidence required

| Domain | Backend | Frontend | Auth | Scope | Idempotency | Concurrency | Audit | Regression/CI | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| Orders | C | C | C | C | C | C | C | C | V |
| Inventory | C | C | C | C | C | C | C | C | V |
| Marketplace | C | C | C | C | C | C | C | C | V |
| B2B | C | C | C | C | C | C | C | C | V |
| Procurement | C | C | C | C | C | C | C | C | V |
| Supplier Network | C | C | C | C | C | C | C | C | V |
| Logistics / Delivery | C | C | C | C | C | C | C | C | V |
| Seller storefront | C | P | C | C | C | C | C | C | V |
| Compliance / Audit UX | C | P | C | C | C | C | C | C | V |
| Generic IAM | C | C | C | C | C | C | C | C | V |
| Contextual IAM | C | P | C | P | P | P | C | P | V |
| Payment Core | C | P | C | C | C | C | C | C | V |
| Payment frontend | C | O | C | C | O | P | P | O | V |
| Provider execution | C | P | C | C | C | C | C | P | V |
| Offline / Outbox | C | C | C | C | C | C | C | C | V |
| Pack lifecycle | D | D | D | D | D | D | D | D | D |

## Payment frontend certification target

PF-1 cannot be marked complete until all of the following are C:
- backend route shapes inspected from live source;
- dedicated frontend client/contract/state boundary;
- authorization-aware requests;
- tenant scope;
- idempotency for mutations;
- backend-projected state;
- audit/lineage visibility;
- focused regression;
- CI gate.

PF-2 must additionally certify:
- duplicate commands;
- conflicting idempotency keys;
- cross-tenant access;
- unauthorized access;
- stale evidence;
- amount/currency mismatch;
- provider reference duplication;
- timeout/retry;
- replay;
- partial payment;
- no direct ledger mutation from frontend.

## Logistics certification note

GAP-2.1–2.13 already established the delivery authority and regression chain. Any new logistics work must preserve those contracts rather than re-certify a replacement architecture.

## Runtime verification rule

Source-level C does not mean CI passed.

If GitHub workflow execution is unavailable or no run is observed, Runtime remains V.

This matrix must be updated when a gap changes state.
