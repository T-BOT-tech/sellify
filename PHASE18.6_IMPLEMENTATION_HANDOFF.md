# PHASE 18.6 — SUPPLIER NETWORK COMMERCIAL TERMS IMPLEMENTATION HANDOFF

Status: IMPLEMENTED / REGRESSION PASS
Baseline: Phase 18.5 Supplier Network Capacity snapshot
Migration: 35

## Scope
Adds descriptive supplier commercial capability metadata without creating a second transactional commercial authority.

## Authority boundaries
- Organization remains canonical identity.
- Product/Catalog remains authoritative for product identity.
- Supplier Network owns commercial capability metadata.
- Procurement owns RFQ/response/comparison/award.
- Existing B2B Quote and Purchase Order remain authoritative for executed commercial transactions.
- Payment Core remains authoritative for payment execution.
- Invoice/AR/Settlement remain authoritative in existing domains.
- Inventory remains authoritative for stock.
- Marketplace seller authority remains separate.

## Data model
`supplier_network_commercial_terms` supports NETWORK, PRODUCT, and CAPABILITY scope. It records MOQ, unit, supported currencies, payment-term capability, lead-time range, wholesale/bulk capability, delivery-term capability, visibility, lifecycle, metadata, actors, timestamps and version.

## API
GET/POST `/tenants/:chatId/supplier-network/commercial-terms`
GET/PATCH `/tenants/:chatId/supplier-network/commercial-terms/:id`
POST `/tenants/:chatId/supplier-network/commercial-terms/:id/{activate|deactivate}`

## Contract
`app/src/supplier-network/commercial-contract.js`
Capability: `supplier-network.commercial`
Authority: `supplier_network`

## Regression
- Phase 18.1–18.6: PASS
- Phase 17 cumulative: 19 PASS / 0 FAIL
- Phase 16.12: PASS
- Phase 0 Golden: 21 PASS / 0 FAIL
- Runtime: Node v22.16.0
- Node >=24 certification: deferred to Phase 16.13

## Non-goals
No quote creation, PO creation, payment, invoice, settlement, inventory mutation, or marketplace seller mutation is performed by this layer.

## Next
Phase 18.7 — Supplier Qualification & Verification.
