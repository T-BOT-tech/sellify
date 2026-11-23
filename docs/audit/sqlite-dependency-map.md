# SQLite dependency map

Baseline `e216db18ade2a5ffa66aff9dc3096e207251a918`; source `backend/lib/store-sqlite.js` at blob `061581230a4443413224508d22aba21eecdbca1b`.

## Inventory totals

- **253** exported store functions.
- **110** unique tables across **112** CREATE TABLE declarations.
- **85** explicit migration guards (85 distinct versions); 83 migration blocks contain detected CREATE/ALTER TABLE or CREATE INDEX changes.
- **206** index declarations.
- **292** REFERENCES clauses, spanning 37 distinct referenced parent tables.
- **228** exported function bodies with direct SQL candidates; **25** have no direct SQL candidate.
- **64** exported functions contain transaction/lock markers.
- **1,681** SQL sub-statements were extracted from **983** `db.prepare` calls and **338** `db.exec` calls. Three arguments are dynamic expressions and remain unresolved.
- **74** low-coupling read/projection candidates are listed for further review; none is approved for extraction.

### SQL operation counts

| Operation | Statements |
|---|---:|
| SELECT | 613 |
| INSERT | 239 |
| UPDATE | 118 |
| DELETE | 3 |
| CREATE TABLE | 111 |
| CREATE INDEX | 206 |
| CREATE TRIGGER | 38 |
| ALTER TABLE | 43 |
| DROP | 8 |
| PRAGMA | 28 |
| BEGIN / COMMIT / ROLLBACK | 230 combined |
| VACUUM | 1 |
| Other / dynamic / trigger terminator tokens | 4 |

Counts are lexical call-site evidence. `db.exec` blocks are split on semicolons; trigger terminators and comments can appear as separate tokens, and the three dynamic SQL expressions are explicitly unresolved. The SQL site list includes source line, operation, referenced tables, owning export/helper attribution, and a bounded SQL preview.

## Function, table and migration map

The JSON records every exported function, source span, candidate area, SQL operation/table/line, direct named function calls, transaction markers, table consumer, table declaration, REFERENCES clause, index and migration guard. Each migration guard is associated with detected tables/indexes created or altered in its source block.

Every table's canonical owner remains **UNASSIGNED**. `candidateArea` is a name/consumer-derived triage hint only. It must not be treated as proof of domain ownership. The cross-area edge list is a review queue, not a violation list.

## Cross-domain invariants that constrain extraction

1. Payment decision/ledger changes with Marketplace allocations and settlements.
2. Payment refund finalization with Marketplace refund/allocation/settlement consequences.
3. Marketplace checkout with catalog reads, inventory reservations, payment allocations, settlement and fulfillment records.
4. Marketplace seller-order status with inventory, refund, settlement and fulfillment consequences.
5. Procurement receipt posting with canonical Inventory movements.
6. Courier assignment and delivery/fulfillment lifecycle with membership, role and location scope.
7. Service resources, availability, commitments and bookings.
8. Supplier Network trust/performance derived evidence over Procurement source facts.
9. Identity memberships, contextual roles, sessions, devices, invites and tenant scope.

These clusters must preserve one atomic mutation boundary and existing canonical authorities. Supplier Network performance/trust is derived evidence; it must not become a duplicate Procurement authority. Procurement receiving must call the existing Inventory authority rather than create a second stock ledger.

## Transaction and extraction interpretation

Transaction marker counts are not a correctness verdict. Preserve caller-owned transactions, `BEGIN IMMEDIATE` locks, rollback, async work, idempotency, audit/outbox writes, serialization queues and `withinTransaction` behavior. A function with no direct transaction marker may still participate in a caller-owned transaction or delegate to a transactional helper. The 74 read/projection candidates still require helper dependencies, indirect calls, authorization, API callers and migration coupling review.

**No persistence extraction is approved.** Keep each cross-domain invariant cluster together. Do not rename tables, change SQL semantics, alter migrations, or create duplicate domain authorities in this audit.
