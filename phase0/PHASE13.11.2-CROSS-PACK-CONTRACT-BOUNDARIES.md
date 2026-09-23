# Phase 13.11.2 — Cross-Pack Contract Boundaries

Status: COMPLETE — 2026-09-08

## Contract direction

Cross-pack integration is organized around canonical capabilities rather than pack-to-pack internal imports.

```text
Vertical Pack
    ↓
Canonical Core Capability
    ↓
Canonical Authority
```

## Initial contracts

### Order → Fulfillment

Commerce remains the Order authority. Existing fulfillment remains the lifecycle authority.

### Fulfillment → Warehouse

Warehouse consumes fulfillment state and participates in existing stock operations. Warehouse does not create a WarehouseFulfillment authority.

### Fulfillment → Logistics

Logistics projects/coordinates physical movement over the existing fulfillment lifecycle. Logistics does not create a second fulfillment state machine.

### Restaurant → Commerce / Payments

Restaurant order/payment compatibility remains a projection/bridge to Commerce and Payments.

### Restaurant → Inventory

Restaurant preparation consumes stock through the existing Inventory mutation and ledger authorities.

### Agriculture → Commerce

Agriculture bridges Commodity/Supply vocabulary to canonical Commerce/B2B capabilities.

### Agriculture → Inventory

Agriculture harvest receipt uses the existing Inventory stock mutation and movement ledger.

### Warehouse → Inventory

Warehouse operations use existing Inventory stock and movement authorities.

### Logistics → Core

Logistics consumes Commerce, Inventory, Customers, Locations, Fulfillment and Audit while owning only its declared logistics entities.

## Contract requirements

Every future cross-pack contract must identify:

- stable identifier
- organization scope
- source
- owner
- direction
- lifecycle
- version
- permission boundary
- idempotency key
- conflict policy
- event behavior
- audit behavior
- reconciliation behavior when asynchronous integration exists

## Non-goals

This increment does not add:

- an integration orchestrator/god service
- dynamic module loading
- provider integrations
- Route implementation
- a new persistence layer
- a new event bus
- duplicate domain authorities
