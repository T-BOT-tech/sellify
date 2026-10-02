# SELLIFY GAP-2 LOGISTICS / DELIVERY SOURCE-OF-TRUTH EXIT

Status: COMPLETE
Branch: main
Exit gap: GAP-2.13
Scope: GAP-2.1 through GAP-2.13
Verification mode: source-level repository verification; GitHub workflow execution was not observed for the final GAP-2 commits.

## 1. Canonical delivery chain

Order / Marketplace Order
→ Seller Order
→ Fulfillment
→ Delivery Assignment
→ Delivery Lifecycle
→ Proof / Exception
→ existing Inventory consequence

Payment and Settlement remain external authorities and are not mutated by delivery lifecycle code.

## 2. Completed GAP-2 boundaries

- GAP-2.1 Assignment authority: canonical assignment command, tenant/location authorization, mandatory idempotency key.
- GAP-2.2 Lifecycle: ASSIGNED → ACCEPTED → OUT_FOR_DELIVERY → DELIVERED, with CANCELLED/FAILED/REASSIGNED exception paths.
- GAP-2.3 Courier scope: active logistics-courier role, ownership, tenant and location scope enforcement.
- GAP-2.4 Exception/recovery: serialized exception reassignment and recovery semantics.
- GAP-2.5 Dispatch workload: tenant/location/courier-scoped active workload projection.
- GAP-2.6 Assignment balancing: deterministic lowest active workload selection with stable user-id tie break.
- GAP-2.7 Delivery proof: proof required for DELIVERED, structured proof validation, immutability after capture.
- GAP-2.8 Route/dispatch scope: read-only projection of existing location, schedule, tracking and destination data; no competing routing authority introduced.
- GAP-2.9 Cross-feature consistency: terminal delivery may invoke the existing inventory consequence only; payment and settlement authorities remain unchanged.
- GAP-2.10 Adversarial testing: duplicate commands, idempotency-key reuse, lifecycle races, active-assignment invariant, tenant/courier scope boundaries.
- GAP-2.11 End-to-end certification: assignment → lifecycle → proof/exception → inventory/audit lineage.
- GAP-2.12 Production readiness: Node 24 floor, CI gates, migrations, SQLite runtime configuration, backup and rollback contracts.
- GAP-2.13 Source-of-truth exit: this document freezes the implemented GAP-2 boundary.

## 3. Critical concurrency guarantees

Lifecycle idempotency lookup executes inside BEGIN IMMEDIATE.

The active delivery assignment is re-read and its current state is validated inside the same transaction before mutation.

Exception reassignment performs its replay check inside its transaction.

Delivery assignment creation is transactionally serialized.

## 4. Regression gates

Required GAP-2 scripts:

- test:gap-2-logistics-authz
- test:gap-2-delivery-assignment
- test:gap-2-delivery-lifecycle
- test:gap-2-delivery-exception
- test:gap-2-dispatch-workload
- test:gap-2-delivery-frontend
- test:gap-2-delivery-certification
- test:gap-2-route-dispatch-scope
- test:gap-2-cross-feature-consistency
- test:gap-2-adversarial-delivery
- test:gap-2-production-readiness

The repository requires Node >=24.

## 5. Final source fingerprints

- backend/lib/store-sqlite.js
  - content SHA: 08140142be09f898a02a295a47142a473c98762f
- backend/server.js
  - content SHA: a704a38fa8f92157df7f51dba5aa08ff4cdb8b48
- app/src/logistics/fulfillment.js
  - content SHA: 0acb39f52f2e2b5658549ad75a6486a6a142b2e2
- package.json
  - content SHA: a354e9be3d772777b5f3a96b99d1205f93f3221d
- .github/workflows/ci.yml
  - content SHA: b1649947ef1dd4556550d79154f9409a8609193d
- phase0/gap-2-adversarial-delivery-regression.mjs
  - content SHA: f8365097c48997a7fd0412e42a48e445f4c7a974
- phase0/gap-2-production-readiness-regression.mjs
  - content SHA: 7b966699bc5e316604b6d53e329686ed49fffbde

## 6. Explicit non-goals / deferred work

GAP-2 does not introduce:
- a new routing engine;
- GPS/navigation authority;
- a separate delivery ledger;
- payment mutation from delivery;
- settlement mutation from delivery;
- replacement of the existing fulfillment/inventory authority;
- marketplace checkout rebuild.

These remain future work only if a later roadmap phase explicitly requires them.

## 7. Operational note

Source-level gates and repository structure were verified from main. No final GitHub workflow run was available for the latest GAP-2 commit sequence, so CI execution status must be established by the repository's normal GitHub Actions environment before treating this snapshot as deployment-certified.

## 8. Handoff rule

Future work must treat this GAP-2 boundary as the current source of truth and must not bypass delivery assignment/lifecycle authority by introducing parallel fulfillment, payment, settlement, inventory, or routing mutations.
