# Phase 14.5 — Document / Invoice Boundary

**Status:** COMPLETE — boundary-only implementation

## Objective

Establish the Ethiopia country-document boundary without creating a second invoice engine or moving invoice authority into the country pack.

## Existing authority inspected

- `app/src/b2b/invoices.js` — existing invoice UI and canonical B2B invoice API consumer.
- `backend/server.js#handleB2BInvoices` — existing B2B invoice API boundary.
- `backend/lib/store-sqlite.js#invoices` — existing invoice persistence and state-transition authority.
- Phase 11.3 invoice migration/schema — existing `invoices` and `invoice_items` persistence.
- `app/src/country-pack-contract.js` — country document contract.
- `app/src/country-tax-boundary.js` — tax boundary established in Phase 14.4.

## Implementation

Added `app/src/country-document-boundary.js`.

The bridge provides:

- country document metadata;
- supported document type declaration (`invoice`);
- explicit reference to the existing B2B invoice authority;
- explicit reference to existing invoice API and numbering authority;
- locale/tax boundary references;
- a non-persistent invoice projection for country-document consumers.

## Authority rules

```text
Country Document Boundary
        ↓
Existing Core B2B Invoice Capability
        ↓
backend/server.js + backend/lib/store-sqlite.js
```

The country layer does **not** own:

- invoice persistence;
- invoice numbering state;
- invoice status transitions;
- invoice tax state;
- document ledger;
- a second invoice API;
- a country-specific invoice table;
- a replacement for `app/src/b2b/invoices.js`.

## Ethiopia status

The Ethiopia contract remains `country_defined / deferred`. This phase therefore formalizes the boundary only; it does not claim Ethiopian legal invoice compliance or implement local fiscal-document rules.

## Migration

None. Existing invoice data and API behavior are preserved.
