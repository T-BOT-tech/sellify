# Phase 15.13 — Document / Invoice Expansion

## Objective
Expand the country and regional document/invoice boundary while preserving the existing canonical B2B invoice authority.

## Authority rule
The phase is declarative only. Existing invoice persistence, numbering, API behavior, and invoice records remain authoritative. Country and regional profiles do not create a second invoice engine.

Canonical authorities:
- Invoice persistence: `backend/lib/store-sqlite.js#invoices`
- Invoice API: `backend/server.js#handleB2BInvoices`
- Invoice numbering: existing B2B invoice authority
- Country document boundary: `app/src/country-document-boundary.js`

## Country posture
ET, KE, TZ, and NG remain active country-document boundaries with implementation deferred. GH and ZM remain strategic candidates and are not activated.

Kenya is explicitly marked as `tax_authority_defined_external` for electronic invoicing because KRA's eTIMS framework provides electronic tax invoicing and system-to-system integration; Sellify does not implement or replace eTIMS in this phase. KRA identifies eTIMS as its electronic tax invoice management system and documents system-to-system integration options. See KRA guidance: https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/what-is-etims

## Regional posture
EAC, WAEMU, and CEMAC are represented only as regional document signals with mandatory country overlays. Regional membership does not create a regional invoice authority.

## Explicit non-goals
- No invoice persistence
- No invoice numbering service
- No document ledger
- No tax state authority
- No payment state authority
- No e-invoicing provider adapter
- No QR/signature authority
- No regional invoice authority

## Exit criterion
Document and invoice boundaries are composable and fail closed against authority duplication while concrete country-specific document rules and provider integrations remain separately approved work.
