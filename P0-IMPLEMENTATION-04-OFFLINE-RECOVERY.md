# P0-IMPLEMENTATION-04 — Offline / Recovery for Procurement Receiving

Date: 2026-09-19

## Scope

This slice hardens the existing P0 procurement → warehouse receiving journey against offline and uncertain transport conditions, using the existing durable outbox as the single local persistence authority.

## Implemented

- Extended `app/src/sync/outbox.js` with durable canonical API-command records alongside the existing domain-event records.
- Added command enqueue, pending/failed inspection, canonical flush, and retry operations.
- Kept generic event synchronization isolated from command records.
- Updated procurement receiving to:
  - queue a receipt command while offline;
  - show `QUEUED`/offline state without claiming server confirmation;
  - preserve the same idempotency key after an uncertain transport failure;
  - retry the same canonical procurement-receiving endpoint when connectivity returns;
  - expose canonical rejection as recoverable `FAILED` work rather than silently discarding it;
  - allow explicit retry without generating a replacement command/idempotency key.
- Existing authority boundaries remain unchanged:
  - Procurement owns receipt records.
  - Inventory remains physical stock / ledger authority.
  - Server authorization remains authoritative.
  - No client-side inventory mutation or second receipt authority was introduced.

## FUX trace

`User command → durable outbox command → idempotency key → canonical procurement receiving API → canonical receipt result → visible UI state`

Offline / transport uncertainty uses `QUEUED` or `UNKNOWN`; it is never rendered as confirmed success.

## Validation

- `node --check app/src/sync/outbox.js` — PASS
- `node --check app/src/warehouse/procurement-receiving.js` — PASS
- `node phase0/p0-04-offline-recovery-regression.mjs` — PASS
- `node phase0/p0-03-procurement-receiving-ui-regression.mjs` — PASS
- `node phase0/phase17.7-procurement-receiving-regression.mjs` — PASS
- `node phase0/phase17.7-receiving-contract-regression.mjs` — PASS
- `node phase0/r2-cross-layer-reliability-hardening-gate.mjs` — 10 PASS / 0 FAIL
- `node phase0/fux29-seller-golden-journey-regression.mjs` — PASS
- `node phase0/fux30-multi-channel-adversarial-regression.mjs` — PASS

Runtime note: current container remains Node 22.16.0. Node 24 certification is therefore not claimed by this slice.
