# Remediation roadmap

- Current source baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Scope: evidence-driven follow-up from route, SQLite, test-command and capacity-boundary audits.

## P0 — close confirmed API authorization gap

1. Add central server-side authorization to `GET /tenants/:chatId/payments/routing/policies` using the existing `payments:view` boundary.
2. Add central server-side authorization to `POST /tenants/:chatId/payments/routing/policies` using the existing Payment management/routing permission policy; do not invent a new permission key without reviewing the existing authorization registry.
3. Add HTTP regressions proving a read-only/unauthorized tenant member cannot list or mutate routing policies, and an authorized actor can. Keep the store's tenant/organization scoping.
4. Verify that the handler cannot bypass the check through alternate routes or direct PaymentCore paths.

## P1 — finish route characterization

1. The 247 explicit routes and six inline branches are now indexed with source locations and handler dependencies.
2. Finish exact test-to-route assertion mapping, especially write routes, public/provider-auth paths, and routes that delegate authorization into domain services.
3. Keep direct store calls, PaymentCore delegation and helper-based authorization distinct in the map.
4. Do not extract route modules until handler-to-store call paths, tenant/location/resource scope, idempotency and side effects have test evidence.

## P1 — preserve SQLite invariants before extraction

1. Validate the 1,639 individual SQL statement inventory against dynamic SQL and indirect helper paths.
2. Review transaction callers for the Marketplace, Payment, Inventory/Fulfillment, Procurement Receiving, Service and Identity clusters identified in `sqlite-dependency-map.md`.
3. Preserve migration source order; 85 guards are not in monotonically increasing numeric order.
4. Validate provisional table ownership with canonical domain contracts. Do not use table prefixes as ownership proof.
5. No `store-sqlite.js` extraction is approved yet. Small candidate clusters remain proof candidates only.

## P2 — capacity and Logistics Scheduling boundary

1. Keep the unified Discovery temporal matcher as the strict matching path.
2. Treat the direct legacy Supplier Network discovery endpoint as advisory quantity ranking only; do not use it for hard time-sensitive feasibility.
3. Keep Procurement RFQ capacity snapshots immutable and clearly labeled as supplier-declared evidence, not operational availability.
4. Define a trusted independent observer identity, provenance and authorization contract before accepting `OBSERVED` or `VERIFIED` evidence.
5. Define a single server-owned operational capacity/feasibility authority and adapter contract before wiring Logistics Scheduling to it.
6. Keep Scheduling request-only until that authority can produce authenticated, durable, scoped feasibility decisions. Do not create a second Supplier Network, Logistics, Inventory or Fulfillment authority.

## P2 — test command consolidation

1. Preserve all 482 historical package scripts and 185 source-hash/source-manifest files.
2. Add wrapper commands only after selecting canonical underlying targets and deduplicating exact command aliases.
3. Proposed wrappers: `test`, `test:integration`, `test:security`, `test:e2e`, `test:release`; do not add them in this audit pass.
4. Ensure `test:security` includes real HTTP authorization/isolation regressions; the current `security.yml` workflow is source-hygiene only.
5. Keep Node >=24 and `node:sqlite` checks in release/certification gates; do not infer global runtime certification from a workflow job alone.

## P3 — maintain current-state documentation

1. Use `docs/audit/` as the current source-level audit set; retain prior `docs/perplexity-audit/` evidence as historical records.
2. Correct only stale current-state claims and add cross-links; do not rewrite historical audit branch SHAs, run results or phase records.
3. Refresh capability investment status after each verified remediation PR and re-run the route/SQLite inventory regressions.

## Extraction gate

A module extraction may proceed only when its route/call graph, canonical authority, SQL tables, foreign keys/indexes, transaction boundary, migration dependencies, authorization/scope, idempotency, side effects and regression coverage are demonstrated. A smaller diff is not sufficient evidence of a safe boundary.