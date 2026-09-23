# Phase 16.2 — Canonical Authority Registry

## Status

**PASS — implementation complete.**

Phase 16.2 introduces a machine-verifiable registry for the existing Sellify domain authorities. It does not create or move any persistence, authorization, transaction, ledger, event-store, broker, or API-gateway authority.

## Authority map

| Authority | Canonical boundary | Execution |
|---|---|---|
| Commerce | existing commerce/order + product authorities | existing domain authority |
| Inventory | `app/src/warehouse/inventory.js#applyStockChange` | existing domain authority |
| Payments | existing payment authority / backend payment modules | existing domain authority |
| Customers | `app/src/customers.js` | existing domain authority |
| Locations | existing organization/location authority | existing domain authority |
| Fulfillment | `app/src/logistics/fulfillment.js` | existing domain authority |
| Documents | `backend/lib/store-sqlite.js#invoices` + existing B2B invoice authority | existing domain authority |
| Audit | existing audit/compliance authority | existing domain authority |
| Country | `app/src/country-configuration.js` | existing configuration authority |
| Vertical | `app/src/verticals/configuration.js` | existing configuration authority |
| Events | `app/src/events/event-boundary.js` + existing outbox | existing event boundary |

## Platform rule

`Consumer → Canonical Capability Contract → Authority Registry → Existing Authority`

The platform layer is declarative and resolution-only. It must not become a second domain core.

## Implemented source

- `app/src/platform/authority-registry.js`
- `phase0/phase16.2-authority-registry-regression.mjs`
- `package.json` — `test:phase16.2`

## Guardrails

The registry rejects platform ownership claims for persistence, database, ledger, event store, broker, authorization, identity store, transaction engine, and API gateway.

Unknown authorities and capabilities fail closed.

## Regression

- Phase 16.2: **30 PASS / 0 FAIL**
- Phase 16.1: **30 PASS / 0 FAIL**
- Phase 16.0: **9 PASS / 0 FAIL**
- Phase 15.20: **126 PASS / 0 FAIL**

The existing Node 22 module-type warning remains pre-existing and does not change the Node `>=24` requirement.
