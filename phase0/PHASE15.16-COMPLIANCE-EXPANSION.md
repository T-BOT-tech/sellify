# Phase 15.16 — Compliance Expansion

## Status
COMPLETE under Node 22.16.0 inspection/runtime. Node >=24 certification remains a separate release gate.

## Objective
Expand Sellify's country/regional compliance boundary without creating a second compliance authority or encoding unsupported jurisdiction-specific legal rules.

## Implemented
- Added `app/src/compliance-expansion-contract.js`.
- Active country overlays: ET, KE, TZ, NG.
- Strategic candidate boundaries: GH, ZM.
- Regional compliance signals: EAC, WAEMU, CEMAC.
- Reused the existing Core compliance/audit authority, audit history, retention policy, compliance requests, and export capability.
- Added declarative compliance signals for audit/retention/access/export/deletion plus AML/CDD, beneficial ownership, sanctions screening, and anti-corruption context.
- Global standards remain contextual only. No jurisdiction-specific rates, thresholds, legal tests, sanctions lists, KYC decisions, AML rules, or regulatory determinations are encoded.

## Authority Boundary
Country/regional compliance expansion is:
`Country/Region Compliance Signal → Existing Core Compliance/Audit Capability`

It does not own persistence, compliance storage, audit, retention storage, identity, authorization, tax ledger, payment ledger, invoice authority, sanctions store, AML/KYC engine, beneficial-ownership store, regulatory rules, or events.

## External research context
FATF's Recommendations establish risk-based customer due diligence and beneficial-ownership expectations, while the African Union Convention on Preventing and Combating Corruption establishes a continental anti-corruption framework. These sources are contextual inputs only; Phase 15.16 deliberately does not encode them as executable jurisdiction rules.

## Regression
`npm run test:phase15.16` PASS.

Existing Phase 10.7 and Phase 14.8 compliance regressions remain historical regression coverage and are not rewritten.
