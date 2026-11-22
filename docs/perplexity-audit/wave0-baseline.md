# Wave 0 verification baseline

## Status

**Inventory gates pass on the current audit branch head.** The first scanner version was materially incomplete and reported only two routes and zero migration markers. The scanner and gates have since been corrected to inspect the central ROUTES array and explicit migration version guards. The results below are static inventory evidence, not proof of runtime completeness or canonical ownership.

## Verified repository baseline

| Item | Value |
|---|---|
| Repository | T-BOT-tech/sellify |
| Audit branch | audit/perplexity-codebase-modularity-20261122 |
| Verified head | 1f8da95a7c8bd1c60c432e5a4e67fa70b56a9e46 |
| Audit workflow | .github/workflows/perplexity-audit.yml |
| Inventory regression check | Passed |
| CI run | https://github.com/T-BOT-tech/sellify/actions/runs/45068439341 |
| Verification date | 2026-11-22 |

## Verified static inventory

| Inventory | Result | Interpretation |
|---|---:|---|
| Explicit API route table entries | 247 | Parsed from the ROUTES array in backend/server.js. |
| Inline HTTP handlers | 6 | Selected health, config, static-module, storefront, and tracking handlers. |
| Total detected route entries | 253 | 35 remain unclassified by the heuristic module classifier. |
| Duplicate method/path keys | 0 | No duplicate display keys detected by the inventory. |
| Exported SQLite store functions | 253 | Static exported-function declarations in store-sqlite.js. |
| Unique SQL tables | 110 | Deduplicated table names from 112 CREATE TABLE declarations. |
| Migration version guards | 85 | Explicit applied.includes(N) migration guards detected. |
| Proposed persistence groups | 14 | Name-based function groupings only; not canonical ownership. |

## Route classification

The path classifier proposes 15 groups, but **35 routes remain unclassified**. It strips the tenant scope prefix before applying domain heuristics, so tenant-scoped procurement, supplier, payment, and logistics routes are not all collapsed into a generic tenant group.

The proposed groups are only review hints. The inventory does not extract handler call graphs, middleware, authorization requirements, transaction behavior, or side effects. In particular, a route's URL prefix is not evidence that a proposed module owns the underlying canonical domain.

## Store inventory

The store inventory deduplicates table names while retaining repeated declaration locations. The 85 migration guards are extracted from the current explicit numbered migration pattern. The tool does not yet map foreign keys, SQL read/write ownership, table dependencies, transaction boundaries, migration dependencies, or cross-domain invariants.

The 14 function groups are based on function-name substrings. They must not be used as persistence extraction boundaries without call-site and SQL analysis.

## Gate limitations

The inventory workflow checks parser coverage floors, record shape, duplicate route keys, unique table names, and migration guard presence/order. It does **not** prove that every runtime route is captured, every route is correctly classified, or each function/table belongs to its proposed group.

Generated timestamped artifacts remain ignored by Git and are not committed. A reviewer must inspect the generated outputs from the same commit being evaluated.

## Still unverified

- The 35 unclassified route entries and all 15 heuristic groups.
- Route handler-to-handler calls, middleware, authorization, tenant/location scope, error behavior, and side effects.
- Dynamic or indirect routes outside the explicit ROUTES table and the six selected inline patterns.
- SQLite foreign keys, unique/index constraints, table dependencies, and table-to-domain ownership.
- Function call graphs and the SQL reads/writes performed by each exported function.
- Transaction boundaries and cross-domain invariants.
- The safest first extraction slice for backend/server.js or backend/lib/store-sqlite.js.

No route count, proposed module, store group, or extraction priority should be treated as a canonical architecture decision until these items are reviewed.

## Separate CI status

The inventory workflow run above passed. The full Sellify CI run for the same verified head is tracked separately:
https://github.com/T-BOT-tech/sellify/actions/runs/45068439164

A passing inventory workflow does not imply that the full CI, certification, or release gates passed.
