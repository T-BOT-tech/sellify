# Phase 13.8.5 — Restaurant Inventory Consumption

## Purpose
Execute a validated Restaurant Preparation consumption plan through the existing canonical Inventory authority without creating `RestaurantInventory`.

## Authority boundary
- Restaurant owns Recipe and Preparation semantics.
- Commerce owns ingredient/product identity.
- Inventory owns stock mutation, persistence, transaction boundaries, audit evidence and movement replay.
- Mutation entry point: `app/src/warehouse/ledger.js#recordCanonicalInventoryMovementBatch()`.
- Durable server boundary: `POST /events/:chatId` with one `inventory.movement.batch.record` event.
- Backend transaction owner: `backend/lib/store-sqlite.js#processSyncEvent()`.

## Flow
`Restaurant Preparation → validated consumption plan → one canonical Inventory batch event → one backend transaction → canonical inventory movements`

All ingredient lines are sent as one event. The backend processes the complete movement array inside one SQLite transaction; a failing line rolls back earlier lines and the batch receipt.

## Idempotency
Each ingredient retains the deterministic movement identity:
`restaurant:organization:<organizationId>:preparation:<preparationId>:ingredient:<productId>`

The outer batch event also has a stable organization- and preparation-scoped identity:
`inventory.movement.batch.record:<organizationId>:restaurant:preparation:<preparationId>:inventory-batch`

An exact replay returns the original processed result. Reusing the event identity with changed intent is rejected.

## Offline and uncertain outcomes
Offline preparation consumption queues one durable batch event, not independent ingredient events. It remains pending until the canonical Inventory authority acknowledges processing. A transport failure queues the exact same event identity and payload so a server-side success can be replayed safely. Pending is not confirmed success.

## Validation
The bridge validates product identity, organization scope, location, duplicate ingredients and positive quantities. Local stock preflight provides early feedback; the server remains authoritative for movement validation and persistence.

## Explicit non-goals
- No RestaurantInventory authority.
- No local stock mutation from the Restaurant bridge.
- No sequential per-ingredient mutation loop.
- No second Inventory ledger or migration.
- No order/payment rewrite.
- This bridge is not yet wired to a persisted Restaurant Preparation completion workflow; that product integration remains a separate task.
