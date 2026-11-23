# Backend modularity plan

## Objective

Reduce coupling and review friction without changing external API behavior.

## Current pressure points

- `backend/server.js` is 274 KB.
- `backend/lib/store-sqlite.js` is 962 KB.
- Domain logic, routing, validation, persistence, and orchestration may be interleaved.
- The npm script surface contains hundreds of phase-specific commands.

## Target backend structure

```text
backend/
  server.js                       # thin composition root
  lib/
    http/
      app.js                      # app creation and middleware
      router.js                   # route registration
      errors.js                   # consistent error mapping
      request-context.js          # auth, tenant, org, location context
    routes/
      auth.js
      procurement.js
      suppliers.js
      inventory.js
      warehouse.js
      logistics.js
      payments.js
      telegram.js
      discovery.js
    domains/
      procurement/
      suppliers/
      inventory/
      warehouse/
      logistics/
      payments/
      discovery/
    persistence/
      sqlite/
        connection.js
        migrations.js
        transactions.js
        inventory-store.js
        order-store.js
        procurement-store.js
        logistics-store.js
        payment-store.js
        supplier-store.js
```

## Server decomposition rules

1. Keep `server.js` as a composition root only.
2. Move HTTP route groups into `backend/lib/routes/`.
3. Move reusable middleware into `backend/lib/http/`.
4. Move domain-specific orchestration into `backend/lib/domains/`.
5. Do not move a route until its authorization, validation, transaction, and error behavior are understood.
6. Preserve route paths, methods, status codes, payloads, and error contracts.
7. Add characterization tests before extracting high-risk routes.

## SQLite decomposition rules

1. First create a persistence inventory: tables, foreign keys, transactions, migrations, and cross-domain invariants.
2. Extract one bounded domain at a time.
3. Keep shared transaction helpers and migration infrastructure in a core module.
4. Do not split tables merely to reduce file size.
5. Preserve existing SQL behavior, constraints, indexes, and transaction boundaries.
6. Run tenant-isolation, authorization, idempotency, replay, and adversarial gates after every extraction.

## Safe first slices

| Slice | Action | Verification |
|---|---|---|
| 1 | Extract HTTP app creation and shared middleware | Existing API smoke and security tests |
| 2 | Extract route registration by domain | Route contract and authorization tests |
| 3 | Extract a low-risk read-only domain store | Domain regression and tenant-isolation tests |
| 4 | Extract event/replay persistence helpers | Event outbox and replay tests |
| 5 | Extract logistics and supplier stores | Logistics, supplier, and adversarial gates |
| 6 | Extract payment and inventory stores last | Payment, inventory, fulfillment, and cross-pack gates |

## Non-goals

- No database engine migration in the first refactor.
- No API contract changes.
- No new scheduling, capacity, payment, or fulfillment authority.
- No broad rewrite of existing business rules.
