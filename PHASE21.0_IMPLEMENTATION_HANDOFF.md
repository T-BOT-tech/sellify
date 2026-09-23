# PHASE 21.0 — BASELINE RE-LOCK

Status: IMPLEMENTED / BASELINE PASS

## Architectural identity
Commodity / Network Coordination Baseline

## Mission
Freeze the existing Agriculture, Supplier Network, Procurement, Discovery, and Cross-Border authorities before any Phase 21 feature is added.

## Non-negotiable ownership
- Agriculture owns Commodity vocabulary and agriculture-specific commodity semantics.
- Product/Catalog remains canonical for product identity.
- Supplier Network owns supplier participation, catalog, capability, service area, capacity, qualification, commercial, performance, trust, and discovery contracts already established.
- Procurement owns procurement demand, RFQ, supplier response, comparison, award, receiving, settlement, and related execution contracts.
- Commerce owns orders and fulfillment.
- Inventory owns stock truth.
- Payment owns payment truth.
- Discovery owns federated discovery and derived opportunity representations.
- Cross-Border owns cross-border coordination/evaluation only.

## Explicit non-goals
Phase 21.0 creates no new commodity database, supplier registry, procurement engine, order authority, inventory authority, payment authority, ledger, event store, or provider integration.

## Reuse-first findings
Existing capabilities to compose before adding anything new:
- `app/src/verticals/agriculture/commerce-contract.js` — Agriculture Commodity, Offer, BuyerDemand and Commerce bridge.
- `app/src/verticals/agriculture/pack.js` — Agriculture-owned entity vocabulary and dependencies.
- `app/src/verticals/agriculture/procurement-bridge.js` — Agriculture Supply → procurement bridge.
- `app/src/supplier-network/catalog-contract.js` — supplier catalog and product/catalog authority boundary.
- `app/src/supplier-network/capability-contract.js` — supplier capability.
- `app/src/supplier-network/capacity-contract.js` — supplier capacity.
- `app/src/supplier-network/qualification-contract.js` — qualification.
- `app/src/supplier-network/service-area-contract.js` — service area.
- `app/src/supplier-network/commercial-contract.js` — commercial terms.
- `app/src/supplier-network/discovery-contract.js` — supplier discovery.
- `app/src/procurement/*` — existing procurement authority.
- `backend/lib/discovery/*` — existing Phase 19 Discovery Fabric.
- `app/src/cross-border-*` — existing Phase 20 coordination layer.

## Baseline rule
Any Phase 21 proposal must first classify the requested capability as REUSE, EXTEND, NEW, or DEFER. A NEW classification requires proof that no existing canonical authority or composition boundary can satisfy the requirement.
