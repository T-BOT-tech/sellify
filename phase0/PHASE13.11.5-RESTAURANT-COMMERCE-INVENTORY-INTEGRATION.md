# Phase 13.11.5 — Restaurant ↔ Commerce / Inventory Integration

**Status:** PARTIAL — canonical batch execution boundary corrected; product workflow wiring remains open.

## Objective
Compose Restaurant semantics with existing Core Commerce, Payments and Inventory authorities without creating parallel Order, Payment or Inventory systems.

## Authority model
- Restaurant: Table, KitchenTicket, Recipe and Preparation semantics.
- Commerce: Order and Product identity.
- Payments: payment intents and payment lifecycle.
- Inventory: stock mutation, canonical movement persistence, transaction and audit evidence.

## Implementation
The persistence-neutral composition contract remains:
- `buildRestaurantCommerceHandoff()`
- `buildRestaurantInventoryHandoff()`
- `buildRestaurantCommerceInventoryContext()`
- `executeRestaurantInventoryHandoff()`
- `restaurantCommerceInventoryContract()`

Restaurant ingredient consumption now delegates to `recordCanonicalInventoryMovementBatch()` in the existing Inventory ledger module. It no longer calls or injects the legacy `applyStockChange()` compatibility function.

All ingredients for one preparation are submitted as one `inventory.movement.batch.record` event through the existing authenticated `/events/:chatId` route. The backend's existing `processSyncEvent()` transaction applies all movement lines atomically and writes the canonical audit/movement evidence.

The same stable batch event identity and payload are retained for offline queueing and transport retry. A queued result is explicitly pending; it is not reported as confirmed consumption.

## Persistence / migration
No new schema, migration, table, ledger, or authority is introduced.

## Remaining product integration
The existing Kitchen UI still transitions local kitchen ticket status and is not yet connected to a persisted Preparation completion workflow. The bridge is now capable of executing a canonical atomic Inventory batch, but the actual user journey that creates/completes a Preparation and invokes this bridge remains open. Do not mark Restaurant canonical Inventory product integration fully complete until that caller and its UI/API regressions exist.

## Regression coverage
- Preparation plan and ingredient identity.
- One batch command for multiple ingredients.
- Stable command and movement event identities.
- Confirmed versus pending result semantics.
- Full idempotent replay.
- Insufficient local stock preflight.
- Organization and location context.
- No legacy `applyStockChange()` dependency in the Restaurant consumption bridge.
- Existing backend batch event transaction and authorization regressions remain required.

## Release gate
Run the targeted Restaurant regressions and existing Inventory batch/event regressions on Node >=24. CI on the exact PR head is the verification authority.
