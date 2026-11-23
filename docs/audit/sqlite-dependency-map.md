# SQLite dependency map

Baseline `e216db18ade2a5ffa66aff9dc3096e207251a918`; source `backend/lib/store-sqlite.js` blob `061581230a4443413224508d22aba21eecdbca1b`.

## Inventory totals

- **253** exported store functions.
- **110** unique tables across **112** `CREATE TABLE` declarations.
- **85** migration guards / distinct versions. **83** migration blocks contain detected table/index DDL; migrations **65** and **66** are trigger-only blocks.
- **38** trigger declarations, now mapped to their migration block, target table and source line.
- **206** index declarations.
- **292** `REFERENCES` clauses, spanning **37** distinct referenced parent tables.
- **228** exported function bodies with direct SQL candidates; **25** have no direct SQL candidate.
- **64** exported functions contain transaction/lock markers.
- **1,681** SQL sub-statements were extracted from **983** `db.prepare` calls and **338** `db.exec` calls. Three SQL arguments are dynamic expressions and remain unresolved.
- **287** provisional cross-area function/table candidates.
- **74** low-coupling read/projection candidates are listed for further review; none is approved for extraction.
- SQL call-site attribution: **950** sites fall within exported-function spans; **731** are assigned to the nearest internal-helper declaration (approximate attribution). Zero sites are left unassigned, but the helper assignments are not equivalent to a proven call graph.

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
| BEGIN | 67 |
| COMMIT | 96 |
| ROLLBACK | 67 |
| VACUUM | 1 |
| Other lexical fragments | 43 |

The 43 lexical fragments comprise 38 trigger `END` terminators, one `DYNAMIC`, one `THESE`, two `BASE`, and one `SQL` token. They are parser/call-site fragments, not 43 additional SQLite business operations. The SQL site list preserves the raw operation labels so no source evidence is discarded.

The SQL-site operation counts for BEGIN/COMMIT/ROLLBACK (67/96/67) differ from the function-body marker scan (109/103/67). The first counts parsed SQL call-site statements; the second counts lexical transaction markers across function spans. Neither count alone proves a balanced or atomic transaction.

## Perplexity inventory cross-check

The current-main Perplexity workflow (run `45254875666`) also passed its SQLite inventory step. The generator counts exports, unique table names, declaration counts and migration guards, then assigns name-based domain hints. It deduplicates table names into a `Map` before its unique-table assertion, so that assertion does not prove the source has no repeated `CREATE TABLE` declarations; declaration counts/lines are retained, and this audit independently records the two repeated names. The generator does not map SQL function-to-table edges, foreign keys, indexes, transaction boundaries, migration trigger DDL or canonical ownership. This dependency map adds those evidence layers without accepting name-based domains as ownership.

## Function, table, foreign-key and migration map

The JSON records every exported function, source span, SQL operation/table/line, direct named function calls, transaction markers, table consumers, table declarations, foreign-key references, indexes and migration guards. Each migration now also records trigger declarations in its source block.

### Repeated table declarations

There are two repeated table names across migration source:

- `pairing_challenges`: declarations at lines 417 and 433 (migrations 2 and 3) are identical `CREATE TABLE IF NOT EXISTS` definitions. This is one physical table and a repeated historical declaration, not duplicate runtime storage.
- `service_resource_commitments`: declarations at lines 3394 and 3440 (migrations 80 and 81). Migration 81 includes compatibility/backfill work and repeats the table declaration with a different `ends_at` CHECK shape. Because the declaration uses `IF NOT EXISTS`, it does not alter a table already created by migration 80. Preserve this migration history and test legacy database shapes before any migration cleanup.

Migrations 65 and 66 create append-only triggers over payment evidence, verification and decision records. They are not empty/no-op migrations; the earlier table/index-only migration summary omitted trigger DDL.

### Table ownership

Every table's canonical owner remains **UNASSIGNED**. `candidateArea` is a name/consumer-derived triage hint only, not proof of domain ownership. The inventory also records tables with no direct exported-function consumer; these may be migration/legacy/trigger support tables and are not automatically orphans.

## Confirmed boundary findings on current main

### High — Procurement receipt and Inventory posting are not atomic as one multi-line operation

`createProcurementReceipt` at line 5579 commits the PENDING receipt and receipt lines in its initial `BEGIN IMMEDIATE` transaction (lines 5640–5653). It then calls `appendInventoryMovement` sequentially outside that transaction (lines 5655 onward). If a later line fails, earlier Inventory movements may already be committed while the receipt remains PENDING; the catch path writes an inventory-pending audit event and rethrows. Deterministic per-line event IDs help safe retries but do not provide all-or-nothing multi-line receipt posting. PR #298 proposes a transaction/serialization fix, but it is not part of this main baseline.

### High — Payment refund/settlement audit arguments are misaligned

The canonical helper signature at line 239 is:

`audit(chatId, action, entityType, entityId, metadata = {}, context = {})`.

Refund/settlement call sites pass the payment ID as `entityType` and actor user ID as `entityId`, rather than using canonical entity types/IDs and actor context. This misidentifies the audited entity and loses actor provenance from audit context. PR #306 proposes the provenance correction, but it is not part of this main baseline.

### High — Refund/settlement request persistence is not atomic with its audit event

`createPaymentSettlement` (around line 9772) and `createPaymentRefundRequest` (around line 9936) insert their child records and call `audit` without a shared transaction. If the audit write fails, the request row can remain persisted without its required audit event. The finalization paths have separate transaction behavior; do not generalize this finding to every refund/settlement operation. The fix must preserve caller-owned transactions and prove rollback on audit failure.

These findings constrain extraction. Keep the affected functions and their audit/ledger/Inventory consequences together until fixed and verified on the current base.

## Cross-domain invariants that constrain extraction

1. Payment decision/ledger changes with Marketplace allocations and settlements.
2. Payment refund finalization with Marketplace refund/allocation/settlement consequences and audit provenance.
3. Marketplace checkout with catalog reads, Inventory reservations, Payment allocations, settlement and fulfillment records.
4. Marketplace seller-order status with Inventory, refund, settlement and fulfillment consequences.
5. Procurement receipt posting with canonical Inventory movements.
6. Courier assignment and delivery/fulfillment lifecycle with membership, role and location scope.
7. Service resources, availability, commitments and bookings.
8. Supplier Network trust/performance derived evidence over Procurement source facts.
9. Identity memberships, contextual roles, sessions, devices, invites and tenant scope.

The cross-domain candidate list is a review queue, not a violation list. Keep each invariant cluster inside one transaction owner and preserve existing canonical authorities. Supplier Network performance/trust remains derived evidence; Procurement remains source-fact authority; Inventory remains stock/movement authority.

## Transaction and extraction interpretation

Transaction marker counts are not a correctness verdict. Preserve caller-owned transactions, `BEGIN IMMEDIATE` locks, rollback, async work, idempotency, audit/outbox writes, serialization queues and `withinTransaction` behavior. A function with no direct transaction marker may still participate in a caller-owned transaction or delegate to a transactional helper.

The 74 read/projection candidates still require helper dependencies, indirect callers, authorization, API callers and migration coupling review.

**No persistence extraction is approved.** Do not rename tables, change SQL semantics, alter migrations, or create duplicate domain authorities in this audit.
