# PHASE 15.19 — CROSS-REGION INTEGRATION

## Status
PASS — boundary-only implementation.

## Objective
Provide a safe composition boundary for flows that span countries and/or regional clusters without creating a regional transaction, payment, inventory, tax, invoice, identity, authorization, audit, event, persistence, or settlement authority.

## Canonical Flow
Country Overlay → Existing Core Capability → External Adapter when required.

Cross-region discovery is metadata only. Country packs remain the activation boundary and existing Core authorities remain authoritative for domain state.

## Activation
- ET, KE, TZ, NG: active country packs.
- GH, ZM: strategic candidates; fail closed until manually activated.
- Other EAC/WAEMU/CEMAC countries: regional country boundary only; country overlay required.

## Cross-region behavior
- KE → TZ resolves within EAC but does not execute through a regional store or transaction engine.
- ET → KE is cross-region composition using country overlays and existing Core capabilities.
- Candidate or unknown countries fail closed.
- Payment settlement remains the existing payment authority.
- Tax remains country-overlay only.
- Events remain the existing versioned event + outbox path.
- Persistence remains none.

## Forbidden authorities
No regional transaction, regional ledger, cross-region settlement, commerce, inventory, payment, identity, authorization, audit, event, tax-ledger, or invoice authority is introduced.

## Regression
`node phase0/phase15.19-cross-region-integration-regression.mjs`

PASS.
