# Wave 0 baseline — architecture, routes, persistence and test surface

Baseline commit: `e216db18ade2a5ffa66aff9dc3096e207251a918`  
Repository: `T-BOT-tech/sellify`  
Branch used for this audit: `audit/route-sqlite-dependency-map` (created from the baseline; audit docs only).

## Repository and runtime surface

| Item | Baseline |
|---|---|
| Backend HTTP composition root | `backend/server.js` — 4,170 lines / 274,791 bytes |
| SQLite store and persistence/domain concentration | `backend/lib/store-sqlite.js` — 14,867 lines / 971,694 bytes |
| Explicit route-table entries | 247 |
| Intentional inline/static handlers | 5
| Pre-dispatch health infrastructure endpoint | 1 |
| Total route entries | 253 |
| Distinct named route handlers | 137 |
| Exported SQLite store functions | 253 |
| Unique SQL tables | 110 |
| CREATE TABLE declarations | 112 |
| Migration guards | 85 |
| Index declarations | 206 |
| REFERENCES clauses | 292 |
| Extracted SQL sub-statements | 1,681 |
| Root package scripts | 482 |
| Test/regression/check/verification/certification/gate/baseline-named scripts | 476 |
| Exact duplicate command groups | 11 groups / 46 script names |
| GitHub workflow files inventoried | 11 |
| `.sha256` files in repository | 189 |

## Route characterization baseline

The 253 route entries are represented in `route-characterization.json`. The map records handler source locations, detectable authentication/permission evidence, scope indicators, input validation/error evidence, idempotency references, direct SQLite calls and transaction evidence, side-effect hints, test candidates and classification.

The route dispatcher rate-limits before dispatch but has no universal session middleware. The detailed source scan records 205 route entries with explicit permission-key evidence and 201 entries with handler authorization calls. It maps 873 direct route-to-store references: 790 join to SQL table evidence, 83 have no direct SQL in their exported function span, and 90 distinct tables are reached by direct exported store calls. 153 route entries use handlers registered for multiple methods; 166 are method-conditional, so handler-wide dependencies must not be attributed to every method. Three entries remain in the security review queue: POST /sync and GET/POST Payment routing-policy routes. Seven buyer/read surfaces are explicitly public or token-scoped. The direct Supplier Network discovery route is a legacy quantity-only filter that can affect candidate inclusion while ignoring unit/availability/time evidence; it is not operational authority. Filename-based test matches are not proof of route coverage.

## SQLite baseline

The 253 exported store functions are mapped to direct SQL operations, tables, direct named function calls and transaction markers. The route map joins 873 direct store references; 790 resolve to SQL table evidence, 83 have no SQL in their own exported-function span, and 90 distinct tables are reached by direct store calls. Table ownership remains unassigned unless canonical authority evidence proves it; name-based candidate areas are hints only.

The 1,681 SQL sub-statements come from 983 `db.prepare` calls and 338 `db.exec` calls. Three dynamic arguments remain unresolved. The inventory records 950 sites within exported-function source spans and 731 sites attributed approximately to internal helper declarations. It also maps 38 triggers across 16 migration blocks; migrations 65 and 66 are trigger-only. Two table names are declared twice across migration history (pairing_challenges and service_resource_commitments); these are repeated IF NOT EXISTS declarations, not two physical tables.

Three high-severity current-main findings are confirmed:
1. Procurement receipt posting commits receipt records before sequential Inventory movement writes; multi-line posting is not atomic.
2. Payment refund/settlement audit calls use shifted positional arguments and misidentify audit entities/actors.
3. Refund/settlement request inserts are not atomic with their audit events.

## Test and CI baseline

- **171 distinct root scripts** are directly referenced by the 11 workflow files; **311** root scripts are not reachable from those direct CI references. This does not prove they are unused.
- 30 distinct direct `node phase0/*` targets appear in workflow commands.
- 11 exact duplicate-command groups map multiple npm aliases to identical command strings.
- Main CI contains baseline, Phase 13 browser/workspace, Logistics L18, Logistics exit certification and Phase 21 capacity evidence jobs.
- Separate workflows cover release certification, Logistics runtime certification, static audit inventory, source hygiene, deployment smoke and focused Supplier Network regressions.
- The `security.yml` source-hygiene job is not the complete authorization/security regression suite.
- Proposed wrapper commands `test`, `test:integration`, `test:security`, `test:e2e`, and `test:release` do not exist yet; `package.json` was not changed.

## Source-hash baseline

There are 189 SHA-256 manifests. At least 11 verified manifests pin root `package.json`; at least two verified manifests pin `.github/workflows/ci.yml`. `PHASE21.18-SOURCE-HASHES.sha256` pins both. Historical manifests must be preserved; do not rewrite old hashes to make a current tree appear to match an older snapshot.

## Perplexity inventory cross-check

The Perplexity inventory workflow passed on this exact main commit (`45254875666`, Node 24), including route and SQLite inventory regression steps. It is a useful independent minimum-coverage gate, not a complete boundary audit. Its route generator deduplicates method/pattern keys before duplicate checking; its store generator deduplicates table names before its uniqueness assertion. This audit independently checks raw route entries and declaration lines, and does not treat proposed module/domain groupings as canonical ownership. The branch `audit/perplexity-codebase-modularity-20261122` has zero commits ahead of current main and is 38 commits behind; its branch snapshot is not a useful current baseline. Historical `docs/perplexity-audit/` records remain preserved.

## CI evidence on the baseline commit

GitHub reported successful completion for:
- Sellify CI
- Sellify Release Certification
- Logistics Runtime Certification
- Perplexity audit inventory
- Repository Security Checks

The main CI check runs include `baseline (24)`, `phase13_10_24 (24)`, `logistics_l18 (24)`, `logistics_exit_certification`, and `phase21_capacity_evidence`. This is commit-specific CI evidence, not proof that all 482 root scripts were executed or that every deployment runs Node 24.

## Scope and non-changes

This baseline audit did not modify production code, database schema, migrations, `package.json`, CI workflows, source-hash manifests or runtime behavior. No route module or SQLite module was extracted. Nothing was merged.

The historical `docs/perplexity-audit/` records are preserved. Current-state refreshes are maintained under `docs/audit/`.
