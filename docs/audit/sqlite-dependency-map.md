# SQLite dependency map

Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`. Source blob: `061581230a4443413224508d22aba21eecdbca1b`.

- Exported store functions: **253**
- Unique SQL table declarations: **110** (112 CREATE TABLE declarations)
- Migration guards: **85** (85 distinct versions)
- Index declarations detected: **206**
- REFERENCES clauses detected: **292**
- Exported function spans with direct SQL candidates: **230**
- Exported function spans with transaction/lock markers: **66**

## Ownership and boundary rules

Every table is explicitly marked UNASSIGNED. Function/table naming is not accepted as proof of canonical ownership. The inventory records direct SQL operations, direct calls to other exported functions, table consumers, indexes, REFERENCES clauses, migration guards and transaction marker locations. Dynamic SQL and helper-mediated access remain limitations and are called out rather than silently treated as absent.

Do not extract a function because it falls into a name-based group. Keep functions together when they share atomic mutations, parent/child idempotency, ledger/audit/outbox consequences, or cross-domain invariants. High-risk examples requiring call-path review include Payment intent/evidence/decision/refund/settlement; Inventory movement/reservation/balance; Procurement award/order/receipt; Supplier Network evidence visibility/ownership; and identity membership/session/device/invite state.

Transaction marker totals are not a correctness result. An extraction boundary must preserve caller-owned transactions, `BEGIN IMMEDIATE` locks, rollback behavior, async work, idempotency and audit side effects. No extraction is approved at this stage.
