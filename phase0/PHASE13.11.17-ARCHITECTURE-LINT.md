# Phase 13.11.17 — Architecture-Lint

## Objective

Formally scan the accumulated Sellify source for prohibited architecture patterns before the Phase 13.11 Integration Matrix and cumulative gate. This phase is a control/lint phase, not a new domain implementation.

## Scope

The lint scans the existing vertical-pack source under `app/src/verticals` and verifies:

1. Vertical pack manifests do not declare duplicate Core Order, Inventory, Product, Payment, Customer, Location, Fulfillment, or Ledger entities.
2. Cross-pack contract/boundary/bridge/integration source remains persistence-neutral.
3. Vertical code does not directly mutate canonical product stock.
4. Route/dispatch engines, providers, optimizers, ledgers, and event streams are not introduced in the vertical layer.
5. Cross-pack contracts do not become orchestration/god services.
6. Canonical authority anchors remain present and Logistics continues to point Fulfillment lifecycle to `app/src/logistics/fulfillment.js` and stock mutation to `app/src/warehouse/inventory.js#applyStockChange`.
7. Raw cross-pack implementation imports are blocked; established contract/boundary/bridge/pack/authority-map surfaces remain the allowed vertical-to-vertical boundary.

## Authority Preservation

- Commerce remains the Order/Product authority.
- Inventory remains the stock and movement authority.
- Payments remains the payment authority.
- Customers remains the customer authority.
- Locations remains the organization/location authority.
- `app/src/logistics/fulfillment.js` remains the Fulfillment lifecycle authority.
- Logistics owns Courier, Route, Shipment, Delivery, Proof, and Return semantics without implementing a route engine.
- Existing `sync_events` remains durable event identity authority.
- Existing audit persistence remains the audit authority.

## Important Compatibility Rule

The lint recognizes that some existing vertical bridges legitimately import an existing Core implementation directly, such as Agriculture using `app/src/warehouse/inventory.js#applyStockChange`. That is not treated as raw cross-pack vertical coupling. The prohibition targets imports into another vertical's implementation directory that bypass the established contract/boundary/bridge surfaces.

## Regression Result

```text
Phase 13.11.17 Architecture-Lint: PASS
Vertical source files scanned: 38
Cross-pack contract/boundary files scanned: 12
Duplicate Core authorities: BLOCKED
Direct vertical persistence: BLOCKED
Direct vertical stock mutation: BLOCKED
Route / dispatch implementation: BLOCKED
Cross-pack orchestration services: BLOCKED
Canonical authority anchors: PASS
Raw cross-pack implementation imports: BLOCKED
```

## Result

Phase 13.11.17 introduces no production domain authority, persistence store, event broker, route engine, dispatch engine, or orchestration service. It adds only the architecture-lint regression and its control documentation/hash.
