# Phase 13.11.6 — Agriculture ↔ Commerce / Inventory Integration

**Status:** COMPLETE — 2026-09-08

## Objective

Formalize the existing Agriculture ↔ Commerce and Agriculture ↔ Inventory boundaries into one persistence-neutral cross-pack contract without creating duplicate Order, Product, Inventory, Payment, or Ledger authorities.

## Actual source inspected

- `app/src/verticals/agriculture/pack.js`
- `app/src/verticals/agriculture/commerce-contract.js`
- `app/src/verticals/agriculture/inventory-contract.js`
- `app/src/verticals/agriculture/inventory-bridge.js`
- `app/src/verticals/agriculture/procurement-bridge.js`
- Phase 13.5 Agriculture Inventory regression
- Phase 13.6 Agriculture Commerce regression
- Phase 13.7 Agriculture Procurement regression

## Authority decision

| Concern | Authority |
|---|---|
| Agriculture vocabulary | Agriculture Pack |
| Product identity | Core Commerce |
| Order | Core Commerce |
| Payment | Payments Core |
| Fulfillment lifecycle | Existing Fulfillment authority |
| Stock mutation | Core Inventory |
| Inventory movement ledger | Core Inventory |
| Inventory idempotency | Existing `event_id` boundary |
| Organization scope | Required |
| Agriculture persistence added | None |

Agriculture continues to own `Farmer`, `Farm`, `Plot`, `Season`, `Crop`, `Harvest`, `Supply`, `Commodity`, `CollectionCenter`, and `Buyer`. It does not gain `AgricultureOrder`, `AgricultureInventory`, `AgricultureProduct`, or `AgriculturePayment`.

## Implementation

Added `app/src/verticals/agriculture/commerce-inventory-contract.js`.

The contract composes the existing bridges:

```text
Agriculture Offer + Buyer Demand
        ↓
Existing Core Commerce Order contract

Agriculture Harvest + Core Product + Collection Center Location
        ↓
Existing Core Inventory movement contract
```

Exports:

- `buildAgricultureCommerceHandoff`
- `buildAgricultureInventoryHandoff`
- `buildAgricultureCommerceInventoryContext`
- `executeAgricultureCommerceHandoff`
- `executeAgricultureInventoryHandoff`
- `isAgricultureCommerceInventoryContext`
- `AGRICULTURE_COMMERCE_INVENTORY_CONTRACT`

Execution functions require injected existing capabilities. The new contract does not create another persistence layer or directly mutate Product stock.

## Regression coverage

`phase0/phase13.11.6-agriculture-commerce-inventory-regression.mjs` verifies:

- Agriculture semantic authority
- Commerce Order/Product authority
- Inventory stock/movement authority
- organization isolation
- product identity continuity
- event identity / replay handoff
- direct Agriculture stock mutation prohibition
- duplicate Agriculture Order/Inventory/Payment authority prohibition
- existing capability injection boundaries

## Existing regression rerun

- Phase 13.11.5 Restaurant ↔ Commerce / Inventory: PASS
- Phase 13.11.4 Warehouse ↔ Inventory: PASS
- Phase 13.11.3 Physical Commerce Spine: PASS
- Phase 13.9.13 Warehouse cumulative gate: PASS
- Phase 13.10.15 Logistics cumulative gate: PASS

## Migration / API impact

**Migration:** none.

**API changes:** none.

**Persistence:** none.

**Production domain rewrite:** none.

## Runtime gate

Observed test runtime remains Node `v22.16.0`. The project requirement remains Node `>=24`; this phase does not lower or alter that requirement. Node 24 production certification remains a release gate.

## Next phase

**Phase 13.11.7 — Agriculture ↔ Warehouse / Logistics**
