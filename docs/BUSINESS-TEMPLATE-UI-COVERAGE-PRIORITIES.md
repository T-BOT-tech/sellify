# Business Template UI Coverage Priorities

Status: evidence-based test prioritization for `feature/workforce-capability-20261124`  
Reviewed: 2026-11-24  
Purpose: choose browser journeys from implemented product behavior, not from the presence of a business-template option.

## Current baseline: Retail

The existing `test:first-experience-onboarding-browser` is the first real browser journey. It exercises the production app and backend with synthetic tenant data and a deterministic Telegram authentication fixture. It currently proves:

- Retail tenant creation and first-product onboarding through the actual UI.
- Product sync to the canonical backend catalog, including ETB minor-unit normalization.
- Canonical `retail-shop` template persistence.
- IndexedDB tenant/session restoration after a reload.
- Product visibility after reload and canonical API re-read.
- Creation of a second business, Settings-based tenant switching, server-issued session exchange, tenant data isolation, and switching back to restore the Retail catalog/template.
- Optional 390 × 844 screenshot evidence.

This is meaningful Retail onboarding and tenant-continuity coverage. The browser journey now also proves a cart → checkout → queued order → real Queue sync → canonical order read. It verifies that choosing a payment method does not confirm receipt and reads `UNPAID` from the sync acknowledgement. Inventory deduction is intentionally not inferred from order creation; stock remains governed by the existing fulfillment/Inventory authority boundary.

### Retail browser transaction coverage (implemented)

The browser test now exercises the real product row and quantity stepper, optional customer details, checkout modal, truthful unconfirmed-payment hint, Queue ticket, Queue Sync now action, sync acknowledgement, and authenticated canonical order feed. It asserts one canonical order with the expected item, quantity, amount, ETB currency, and unpaid payment state from the correct acknowledgement source. This runs with a temporary SQLite database and synthetic tenant.

### Restaurant browser journey (implemented)

The same browser regression creates a separate synthetic Restaurant tenant, switches it through the real Settings tenant switcher, enables Restaurant mode through Settings, creates a menu item through Catalog and synchronizes it through Queue, creates a table through the Tables modal, assigns table and course in the Order UI, saves the order through checkout, verifies the Kitchen ticket retains the table context, advances it from pending to preparing, then synchronizes and verifies the canonical Commerce order and menu-item quantity. Kitchen remains a projection over the existing Core order; the test does not create a parallel order, payment, or inventory authority.

Verified on commit `71d87ac08bfcbf5dcde2acabd4e754d58e0a7188`: all four preview profiles and Workforce verification passed.

### Remaining Retail follow-up (not a blocker for the transaction journey)

The current browser journey proves the saved order remains canonical and unique before reload; the existing reload assertion currently focuses on the catalog and tenant session. A later Retail increment can add:

1. Reload and verify the queued order remains visible without duplicate order creation.
2. Verify inventory changes only at the existing canonical fulfillment/stock authority boundary; do not assume order creation itself deducts stock.

Keep the test data synthetic, use a temporary SQLite database, and retain the current multi-tenant isolation assertions. Preserve separate backend payment/order contract tests; the browser journey should prove UI-to-canonical behavior, not duplicate every backend state-machine case.

## Recommended template sequence

The nine onboarding choices are not nine equally mature vertical applications. The starter-offering module explicitly describes its suggestions as catalog defaults, not business-specific records, booking workflows, inventory authorities, Pack activations, or readiness claims.

| Priority | Template(s) | Existing implementation evidence | Recommended coverage |
|---|---|---|---|
| Complete | `retail-shop` | Real onboarding, catalog sync, checkout, queue, canonical order read, tenant switching and isolation | Browser transaction journey verified; keep stock/fulfillment assertions at canonical Inventory boundaries |
| Complete | `restaurant` | Dedicated Tables and Kitchen UI, table/kitchen/recipe/inventory contracts, plus the new browser journey | Browser journey verified: menu item → table/course → checkout → Kitchen preparing → canonical Commerce order; Inventory handoff remains contract-covered and authority-bound |
| P1 — B2B workflow | `wholesale` | Dedicated B2B workspace surfaces (quotes, purchase orders, credit terms, receivables, invoices), plus backend pricing/quote/PO/credit/AR/invoice/procurement suites | Add a focused browser journey for business customer → customer-specific pricing/quote → accepted quote or existing PO flow. Do not force it through the retail cash-checkout journey |
| P2 — service-led | `barbershop`, `consultation` | Service item type and starter suggestions; service-booking status/transition contract; appointments UI and customer appointment browser regression; service provider/resource foundations | Reuse one service-booking browser harness, first prove appointment request → acceptance/confirmation → completion and tenant-scoped visibility; vary service offerings and labels for each template. Do not assert inventory consumption |
| P2 — mixed repair workflow | `repair` | Product and service starter suggestions, service resource/provider scope, booking/scheduling boundaries, spare-part and diagnostics offering contracts | After the shared service journey, add a repair-specific browser path only if the UI exposes a real work/booking workflow: diagnostics or repair service plus spare part. Keep parts in Inventory and service booking in its own authority |
| P3 — defer pending domain workflows | `hotel-rooms`, `rental` | Starter suggestions only (room-stay/night and equipment/vehicle rental); no equivalent evidence in the reviewed files of complete room availability/reservation or asset availability/checkout-return lifecycle UI | Keep contract/configuration coverage. Do not create browser journeys that merely add a generic catalog item and label it a hotel/rental flow. Promote only when the corresponding reservation/asset lifecycle is implemented |
| P3 — generic fallback | `other` | Generic product/service fallback suggestions; no dedicated vertical workflow is implied | Retain generic onboarding/catalog smoke coverage; do not spend a dedicated end-to-end template slot unless a concrete fallback-specific behavior exists |

## Why this sequence

1. Retail is already the live browser baseline, so finish its most important missing user outcome instead of creating eight shallow template screenshots.
2. Restaurant has the strongest distinct vertical UI and integrated domain behavior after Retail; a browser test can validate genuinely different user work.
3. Wholesale has substantial implemented B2B behavior, but its correct journey is quote/order/account based, not a retail checkout clone.
4. Barbershop and consultation share the existing service/appointment capability. One reusable service journey with template-specific offering data is more valuable than duplicate browser suites.
5. Repair merits a focused extension because it combines service work and physical spare parts, but should follow proof of the shared service workflow.
6. Hotel and rental should wait for actual reservation/asset lifecycle UI. Offering labels such as “Room stay offering” or “Equipment rental” do not prove those workflows exist.
7. `other` is a fallback, not a vertical.

Agriculture is a separate implemented vertical Pack with Farm/Plot/Season/Crop/Harvest/Supply entities and cross-pack commerce/inventory/procurement integrations. It is not one of the nine onboarding template keys, so evaluate it as a Pack integration journey rather than inventing an `agriculture` onboarding template.

## Coverage language and guardrails

- Distinguish catalog-suggestion contract coverage, persistence/API coverage, browser UI coverage, and complete business workflow coverage.
- A template being selectable or persisted does not prove its domain workflow is implemented.
- Browser journeys must use the real application UI and canonical backend, synthetic tenants, isolated temporary databases, and deterministic external-service fixtures.
- Never claim provider payment success from a mocked client response; canonical payment state must remain authoritative.
- Never create parallel inventory, payment, booking, room, rental-asset, or order authorities to make a template test pass.
- Add each template to the preview workflow only after its browser test exists, is deterministic, and has been verified independently.
