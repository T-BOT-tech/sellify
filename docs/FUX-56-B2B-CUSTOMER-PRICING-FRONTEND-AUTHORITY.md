# FUX-56 — Canonical B2B Customer Pricing Frontend Authority

Connects customer-specific negotiated pricing to the existing canonical B2B pricing API. The browser is a projection/command surface and does not persist a local pricing ledger.

Canonical path: B2B pricing intent → API → authorization → customer/product validation → customer_pricing_rules → audit → UI projection.

Endpoints: GET/POST /tenants/:chatId/b2b/pricing and PATCH /tenants/:chatId/b2b/pricing/:pricingId.

This phase does not change payment and does not replace the separate legacy pricing-tier/volume-discount compatibility mechanism.
