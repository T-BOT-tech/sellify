# Phase 15.12 — Tax Boundary Expansion

## Objective
Expand the tax boundary contract across active country packs, strategic country candidates, and regional clusters without introducing a second tax authority.

## Authority rule
The phase is declarative only. It does not calculate tax, persist tax state, create a tax ledger, own invoice tax state, or implement rates, exemptions, thresholds, filing, or tax-provider integrations.

## Regional posture
EAC, WAEMU, and CEMAC are represented as regional harmonization signals with mandatory country overlays. UEMOA's treaty explicitly provides for harmonization of member-state tax regimes, including indirect taxes; current UEMOA material describes harmonization of VAT and excises. citeturn0search0turn0search24 CEMAC/WAEMU tax harmonization is also documented in comparative IMF work. citeturn0search15

## Country posture
ET, KE, TZ, NG remain active country-pack tax boundaries with implementation deferred. GH and ZM remain strategic candidates and are not activated by this phase.

## Explicit non-goals
- No tax-rate engine
- No tax ledger
- No tax persistence
- No invoice-tax state authority
- No payment-tax state authority
- No regional tax authority
- No filing/e-invoicing provider adapter

## Exit criterion
Tax boundaries are composable and fail closed against authority duplication while all concrete tax rules remain deferred to a separately approved implementation phase.
