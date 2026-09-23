# Phase 13.11.13 — Cancellation / Returns

## Status

**COMPLETE**

This phase connects the existing Core Order / Fulfillment projection, the existing Logistics Return workflow, and the Phase 13.11.10 versioned event envelope without introducing a second cancellation, return, fulfillment, inventory, payment, or event persistence authority.

## Existing authorities preserved

| Concern | Authority |
|---|---|
| Order / cancellation representation | Commerce / existing Core Order authority |
| Fulfillment lifecycle | `app/src/logistics/fulfillment.js` |
| Return semantics and transitions | Logistics Pack / `proof-return-contract.js` |
| Inventory authority | Inventory |
| Actual stock mutation | `app/src/warehouse/inventory.js#applyStockChange` |
| Event envelope | `app/src/events/event-boundary.js` |
| Event persistence | existing Outbox + backend `sync_events` |
| Dispatch | not implemented |
| Route implementation | blocked / non-build |

## Implementation

Added:

- `app/src/verticals/logistics/cancellation-return-contract.js`
- `phase0/phase13.11.13-cancellation-returns-regression.mjs`
- this phase control document
- Phase 13.11.13 source hashes
- `test:phase13.11.13` package script

The new contract is persistence-neutral and composes existing capabilities:

1. **Cancellation handoff** represents cancellation intent against the existing Core Order authority. It does not invent a `cancelled` fulfillment status and does not mutate the order.
2. **Return handoff** validates an existing Logistics Return against the same Core Order, organization, and location.
3. **Return transitions** delegate to the existing Logistics Return state machine.
4. A return reaching `received` marks that an explicit inventory disposition may be required, but it does **not** restock stock automatically.
5. **Unified Fulfillment continuity** is established through the existing `buildUnifiedFulfillmentContext()` contract.
6. **Event compatibility** uses `buildVersionedEvent()` only. The current backend still accepts only its existing sync event handlers, so this phase deliberately does not publish a new unsupported return event into the backend processor.

## Return lifecycle

Existing Logistics transitions remain authoritative:

```text
requested -> approved -> in_transit -> received
requested -> rejected
requested -> cancelled
approved  -> cancelled
```

Terminal states remain `received`, `rejected`, and `cancelled`.

## Inventory rule

A return reaching `received` does not automatically mutate inventory. Any restock, quarantine, write-off, or other disposition must use an explicitly injected canonical Inventory capability. No `ReturnInventory`, return ledger, or direct `product.stock` mutation is introduced.

## Event rule

The contract can construct a canonical versioned event envelope such as `logistics.return.transitioned`, but the current backend's durable consumer boundary remains limited to its existing supported event types. Therefore this phase does not add a new backend event handler or silently enqueue an event that would currently be rejected.

## Isolation rules

- organization scope is required
- location scope is preserved when present
- Return must reference the same Core Order
- Core Fulfillment remains the only fulfillment lifecycle authority
- Logistics remains the Return semantic authority
- Inventory remains the stock authority
- no duplicate Return persistence
- no duplicate Fulfillment authority
- no duplicate Inventory authority
- no dispatch implementation
- no route implementation

## Regression coverage

`phase0/phase13.11.13-cancellation-returns-regression.mjs` verifies:

- Core Commerce cancellation ownership
- Logistics Return ownership and transition continuity
- Unified Fulfillment continuity
- organization/location isolation
- Return-to-Core Order identity continuity
- received-return Inventory disposition boundary
- no direct stock mutation or persistence
- versioned event envelope compatibility
- unsupported backend return-event publication remains blocked
- dispatch and route implementation remain blocked

## Runtime note

The environment used for this phase reports Node `v22.16.0`, while the project remains locked to Node `>=24`. This phase therefore does not claim Node 24 release certification. Existing `MODULE_TYPELESS_PACKAGE_JSON` warnings are pre-existing and were not changed.
