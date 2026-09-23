# SELLIFY R1 — Supplier Network + Procurement Productization

**Date:** 2026-09-17  
**Status:** IMPLEMENTED — TARGETED REGRESSION PASS; RELEASE CERTIFICATION REMAINS BLOCKED BY RUNTIME

## CURRENT PHASE
R1 — Capability → API → UI → Authority Trace Matrix, first implementation slice: **Supplier Network + Procurement**.

## OBJECTIVE
Turn the already-implemented Supplier Network and deterministic Procurement backend capabilities into a coherent first-class PWA sourcing workspace without creating a second authority or rewriting existing domain behavior.

Target journey:

`Supplier Discovery → Supplier Relationship → Procurement Demand → Sourcing → RFQ → RFQ Response boundary → Comparison → existing B2B Purchase Order`

## SOURCE INSPECTION
Inspected the actual Phase 22.13 source snapshot before modification:

`SELLIFY_PHASE22_13_SOURCE_SNAPSHOT_EXIT_2026-09-15.zip`

Relevant inspected areas:
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- `backend/lib/authorization.js`
- `app/index.html`
- `app/src/main.js`
- `app/src/ui/tabs.js`
- `app/src/supplier-network/*`
- `app/src/procurement/*`
- Phase 17 / 18 / 22 regression scripts

Source inspection confirmed that Supplier Network profiles/capabilities/catalog/capacity/service-area/commercial/qualification/trust/discovery and Procurement demand/RFQ/comparison/award/PO foundations already exist in the domain layer. The important productization gap was the missing first-class frontend workflow and missing HTTP exposure for already-existing RFQ/relationship operations.

## CURRENT STATE
Before this slice:
- Supplier Network and Procurement domain contracts/persistence existed.
- Supplier discovery API existed.
- Procurement demand API existed.
- Procurement comparison/award/PO APIs existed.
- RFQ persistence and service functions existed, but RFQ HTTP handlers/routes were not exposed.
- Supplier relationship persistence/service functions existed, but relationship HTTP handlers/routes were not exposed.
- The PWA had no first-class Supplier Network + Procurement workspace.

## SOURCE OF TRUTH
- Supplier identity remains the canonical `Organization` authority.
- Supplier participation/relationship remains in the existing Procurement/Supplier Network domain.
- Procurement demand/RFQ/comparison/award remains Procurement authority.
- B2B Purchase Order remains the existing B2B/Commerce authority.
- No new supplier registry, procurement database, commerce engine, inventory ledger, payment ledger, or transaction authority was introduced.

This preserves the architecture rule: external systems and future providers remain behind canonical contracts/adapters; provider-specific schemas do not become canonical SELLIFY models.

## IMPLEMENTATION
### Backend
Added HTTP exposure for existing domain functions:
- Supplier relationship list/create/transition.
- Procurement RFQ list/get/create/transition.
- Procurement RFQ response create/submit boundary.

The handlers use the existing tenant session and centralized authorization layer.

### Frontend
Added:
- `app/src/procurement/ui.js`
- new **Sourcing** workspace in `app/index.html`
- Sourcing tab integration in `app/src/ui/tabs.js`

The workspace provides:
- deterministic Supplier Network search
- supplier relationship creation/activation
- procurement demand creation and lifecycle actions
- RFQ creation and send/close lifecycle
- RFQ response-count visibility
- comparison creation for closed RFQs
- refreshable sourcing pipeline

The UI calls existing backend capabilities; it does not persist sourcing state locally.

## FILES CHANGED
- `backend/server.js`
- `app/index.html`
- `app/src/ui/tabs.js`
- `app/src/procurement/ui.js` (new)
- `phase0/r1-supplier-procurement-productization-regression.mjs` (new)
- `phase0/R1_SUPPLIER_NETWORK_PROCUREMENT_PRODUCTIZATION_2026-09-17.md` (this control artifact)

## MIGRATION
**None.**

Existing Procurement/Supplier Network migrations already provide the required persistence. This slice adds HTTP/UI composition only and therefore does not add schema state.

## API CHANGES
New HTTP exposure over existing domain authorities:
- `GET/POST /tenants/:chatId/procurement/supplier-relationships`
- `POST /tenants/:chatId/procurement/supplier-relationships/:id/:status`
- `GET/POST /tenants/:chatId/procurement/rfqs`
- `GET /tenants/:chatId/procurement/rfqs/:id`
- `POST /tenants/:chatId/procurement/rfqs/:id/send|close|cancel`
- `POST /tenants/:chatId/procurement/rfqs/:id/responses`
- `POST /tenants/:chatId/procurement/rfqs/:id/responses/:responseId/submit`

No new transaction authority was created by these endpoints.

## TEST PLAN / EXECUTED VERIFICATION
Executed under the available runtime **Node v22.16.0**:

1. `node --check backend/server.js` — PASS
2. `node --check app/src/procurement/ui.js` — PASS
3. `node --check app/src/ui/tabs.js` — PASS
4. `node phase0/r1-supplier-procurement-productization-regression.mjs` — PASS
5. `node phase0/phase17.3-rfq-contract-regression.mjs` — PASS
6. `node phase0/phase18.12-supplier-network-final-exit-regression.mjs` — PASS
7. `node phase0/phase22.8-procurement-integration-regression.mjs` — PASS (13/13)
8. `node phase0/golden-regression.mjs` — PASS (21/21)

The R1 regression specifically checks route exposure, UI wiring, permission-boundary wiring, idempotency use, and absence of local procurement/supplier persistence in the new UI.

## RISKS / LIMITATIONS
- The current environment remains Node 22.16.0 while the project declares Node >=24 because of `node:sqlite`. Therefore this implementation is **not release-certified under the supported runtime**.
- The new RFQ response HTTP boundary is exposed for supplier-side use, but this slice does not create a separate supplier portal/workspace. It deliberately avoids duplicating the buyer sourcing workspace into another application.
- The frontend RFQ form currently accepts supplier organization IDs directly. A later UI refinement can derive those IDs from active discovery/relationship selections without changing backend authority.
- No production-scale capacity claim is made.

## DELIBERATELY NOT CHANGED
- Existing Commerce order engine.
- Existing B2B quote/purchase-order authority.
- Existing Supplier Network persistence/contracts.
- Existing Procurement persistence/contracts.
- Existing Inventory authority.
- Existing Payment Core.
- Existing Discovery deterministic ranking logic.
- Existing AI Procurement contracts.
- Existing migrations.
- Existing external adapter framework.
- Existing Logistics and Cross-Border authorities.

These were intentionally preserved because this slice is productization/composition, not a domain rewrite.

## IMPLEMENTATION RESULT
**R1 first vertical slice implemented.**

The system now has a first-class PWA entry point for the Supplier Network → Procurement journey while continuing to route execution through existing canonical authorities.

## VERIFICATION
Targeted regression and golden regression passed with 0 failures. Supported-runtime release certification remains blocked until the same evidence is executed under Node >=24.

## NEXT STEP
Proceed to the next R1 slice only after this source snapshot is retained as the new working baseline:

**Discovery + Supply Intelligence productization**, using the same rule: inspect actual source → expose existing capabilities → add the smallest UI/API composition needed → test → hash → snapshot.
