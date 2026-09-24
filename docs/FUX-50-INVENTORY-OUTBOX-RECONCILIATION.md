# FUX-50 — Inventory Synchronization / Outbox Reconciliation

## Objective

Audit and harden the inventory synchronization boundary after FUX-49 so offline inventory intent cannot become a second inventory authority.

## Canonical path

Online:

Warehouse intent → POST /tenants/:chatId/inventory/movements → canonical inventory_movements ledger

Offline:

Warehouse intent → inventory.movement.record event → durable outbox → reconnect /events/:chatId → canonical inventory_movements ledger

The event carries one stable eventId. Replays therefore target the same canonical ledger identity.

## Findings

- The existing durable outbox is the single local delivery mechanism.
- Inventory events use inventory.movement.record.
- The server validates tenant/session authorization before processing.
- The server processes inventory events through the same appendInventoryMovement() authority used by the online API.
- inventory_movements.event_id is unique and checked before insertion.
- sync_events.event_id records delivery processing and rejects reuse with a different payload.
- Server-processed events are marked synced; rejected application results remain rejected.
- Transport failures retain the outbox item and error metadata for retry rather than marking it synced.
- A queued inventory intent is not projected into canonical inventory balance before server acceptance. This preserves UNKNOWN ≠ SUCCESS.

## FUX-50 hardening

The online canonical inventory path now treats a fetch/network failure as a queueable transport failure. The exact event payload and eventId are retained, so reconnect can safely retry even when the original request may have reached the server but its response was lost.

HTTP/application failures remain visible to the caller instead of being silently queued as successful work.

## State vocabulary

- pending — durable local work awaiting delivery.
- synced — server explicitly accepted/processed the event.
- rejected — server explicitly rejected the event.
- transport failure — item remains pending with error/attempt metadata; it is not success.
- canonical balance — derived only from accepted server inventory movements.

## Regression

phase0/fux-50-inventory-outbox-regression.mjs

The gate covers client event identity, durable outbox semantics, transport-failure handling, server event dispatch, replay protection, and canonical inventory idempotency.

## Certification boundary

This source regression does not prove physical Android offline/reconnect behavior. Device-level offline validation remains a separate runtime evidence item.
