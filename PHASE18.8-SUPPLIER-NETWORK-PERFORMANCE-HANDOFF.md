# PHASE 18.8 — SUPPLIER NETWORK PERFORMANCE HANDOFF

Status: IMPLEMENTED
Migration: 37

Supplier Network stores immutable derived performance observations. Procurement RFQs, B2B purchase orders, and procurement receiving remain authoritative for source facts.

Metrics: RFQ_RESPONSE_RATE, FILL_RATE, PO_COMPLETION_RATE, CANCELLATION_RATE, OBSERVED_PURCHASE_ORDERS.

Observations are snapshots calculated over a bounded period (default 180 days). Recalculation appends a new observation set and never rewrites or deletes historical observations.

The engine deliberately does not infer on-time delivery because the current canonical PO/receiving model does not expose a frozen supplier delivery-commitment boundary suitable for that metric. That is deferred to a future controlled extension.

API:
- GET `/tenants/:chatId/supplier-network/performance`
- GET `/tenants/:chatId/supplier-network/performance/:observationId`
- POST `/tenants/:chatId/supplier-network/performance/:supplierOrganizationId/recalculate`

Permissions: `supplier-network:performance:view`, `supplier-network:performance:recalculate`.

Performance observations are immutable at the database boundary.

Node >=24 certification remains deferred to Phase 16.13 because the observed runtime is still Node 22.16.0.
