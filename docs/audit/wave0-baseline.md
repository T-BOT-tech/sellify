# Wave 0 current-main baseline

- Repository: `T-BOT-tech/sellify`
- Audited default branch: `main`
- Source commit: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Audit branch: `audit/route-sqlite-boundary-map-2026-11-23`
- Scope: route characterization, SQLite dependency map, test command mapping and capacity/scheduling boundary. No production code changes.

## Verified static inventory

| Inventory | Result | Source / interpretation |
|---|---:|---|
| Explicit API route-table entries | 247 | `backend/server.js` `ROUTES` array. |
| Inline dispatch branches | 6 | `/health`, `/config.js`, `/backend/lib/*`, `/shared/*`, `/store/:id`, `/track`. |
| Total detected route entries | 253 | 247 central + 6 inline. |
| Distinct named route handlers | 137 | All central route entries resolve to a named handler declaration. |
| Duplicate method/pattern keys | 0 | Static route-key comparison. |
| Heuristic unclassified entries | 35 | 30 real domain routes + 5 static/inline branches; `/config.js` is separately classified. |
| Exported SQLite store functions | 253 | Static declarations in `backend/lib/store-sqlite.js`. |
| Individual SQL statements | 1,639 | From 1,318 literal SQL API calls across the full file; 947 literal calls are inside exported function bodies. |
| Dynamic SQL call sites | 3 | Listed separately in SQLite JSON. |
| Unique SQL tables | 110 | From 112 table declarations. |
| Foreign-key declarations / unique edges | 286 / 280 | Repeated DDL declarations preserved separately. |
| Index declarations / unique names | 206 / 192 | Repeated index names retained in declaration inventory. |
| Migration guards | 85 | Source order is not numerically ascending; preserve actual order. |
| Package scripts | 482 | Current root `package.json`; 345 use `test:` prefix. |
| Duplicate command groups | 11 | 10 test alias groups + `dev`/`dev:backend`; 46 script names in groups. |
| Direct workflow test invocations | 203 | 173 `npm run` and 30 direct Node files across 11 workflows. |
| Source-hash/source-manifest files | 185 | Historical manifests preserved. |

## Audit artifacts

- `route-characterization.md` and `.json`: all 253 route/dispatch entries, handler/source locations, auth and permission evidence, scope signals, direct store dependencies, errors/idempotency signals, and known gaps.
- `sqlite-dependency-map.md` and `.json`: 253 exported functions, 1,321 SQL API calls (1,318 literal + 3 dynamic), 110 tables, direct local call edges, transactions, schema relationships, indexes, migrations and cross-domain invariants; `sqlite-sql-statements.json` contains all 1,639 normalized statements.
- `test-command-map.md` and `.json`: 482 scripts, duplicate command aliases, CI job invocations, source-hash manifests and additive wrapper proposal.
- `capacity-scheduling-boundary.md`: current unified Discovery, legacy discovery, RFQ snapshot and request-only scheduling boundaries.

## Findings that affect the baseline

1. `POST /tenants/:chatId/payments/routing/policies` has no central payment permission check; the store upsert also does not authorize the actor. This is a confirmed route authorization gap. GET lacks the `payments:view` check used elsewhere.
2. The unified Discovery path applies the strict time-bound capacity matcher; the direct legacy Supplier Network discovery route calls `discoverSupplierNetwork` without the temporal/unit checks.
3. `OBSERVED`/`VERIFIED` capacity evidence has no trusted independent observer identity/provenance contract. Supplier declarations remain `SELF_REPORTED` or `UNKNOWN`.
4. Logistics Scheduling remains request-only. The evaluator hardcodes `externalEvaluation = null`; transitions to `SCHEDULED` fail closed on unknown feasibility.
5. SQLite migration guard source order is non-monotonic; this is an audit observation, not a claim of a migration failure.

## Verification status and limitations

- All generated route and SQLite JSON artifacts were re-read from the audit branch and parsed successfully; counts were cross-checked against the source commit.
- This pass did not run the full CI, release certification, or runtime test suite. Existing CI workflows are mapped in `test-command-map.md`; passing historical CI evidence is not presented as a test run for this audit branch.
- Static SQL and function-call extraction can miss dynamic SQL, imported/indirect calls, and callback dispatch. Transaction markers require caller-graph review.
- Route test candidates are not yet all linked to exact test assertions.
- Table ownership is provisional and based on schema shape, observed function access and domain contracts; no extraction is approved.