# Phase 17.3 — RFQ + Supplier Response Foundation

RFQ is procurement-owned and distinct from the existing B2B Quote. RFQ snapshots the sourcing demand and explicitly addresses active buyer-supplier relationships. Supplier responses remain procurement-owned until a later deterministic comparison/award stage.

States: RFQ `DRAFT → SENT → CLOSED/EXPIRED/CANCELLED`; response `DRAFT → SUBMITTED/WITHDRAWN`, with `SUBMITTED → WITHDRAWN/REJECTED`.

No inventory, payment, B2B Quote, B2B PO, Commerce Order, settlement or award mutation occurs in this phase. Existing outbox/event boundary remains the only event persistence boundary.
