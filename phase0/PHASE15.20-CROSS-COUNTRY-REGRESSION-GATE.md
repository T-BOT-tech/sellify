# PHASE 15.20 — CROSS-COUNTRY REGRESSION GATE

## Status
PASS — integrated cross-country regression gate under Node 22.16.0.

Node >=24 certification remains a separate pending release gate.

## Objective
Validate the accumulated Phase 15 country, regional, money, tax, document, phone/address, payment, compliance, security, event/outbox, and cross-region boundaries without changing historical phase authorities or creating new regional authorities.

## Gate coverage
The gate verifies:
- ET, KE, TZ, NG remain active country packs.
- GH and ZM remain strategic candidates and fail closed.
- Non-activated EAC/WAEMU/CEMAC members remain regional-country-boundary-only and fail closed.
- KE → TZ remains an EAC composition with no regional execution/persistence.
- ET → KE remains cross-region composition through country overlays and existing Core capabilities.
- Existing payment provider/channel registries remain authoritative and country payment mappings remain declarative.
- Country event/outbox expansion remains on the existing versioned event + outbox path.
- Country security remains subordinate to canonical tenant/location/authorization authorities.
- Tax, document/invoice, phone/address, and money expansion remain boundary-only.
- No duplicate regional database/store/ledger/transaction authority is introduced by the Phase 15 expansion modules.

## Historical regression compatibility
Historical phase tests that encode an earlier country/provider state are not rewritten to make them pass after an intentional additive migration. For example, the historical Phase 15.7 Tanzania test expected an empty payment-provider declaration before Tanzania was mapped to the existing M-Pesa registry entry. That test is intentionally stale after Phase 15.15 and is not treated as a production regression failure.

## Gate result
`node phase0/phase15.20-cross-country-regression-gate.mjs`

**126 golden assertions: PASS / 0 FAIL**

Additional accumulated regressions from Phases 15.10–15.19 passed under the current source snapshot. Pre-existing module-type warnings remain unchanged.

## Authority rule
Phase 15 remains additive:

`Country Overlay → Existing Core Capability → External Adapter`

No regional commerce, inventory, payment, identity, authorization, audit, event, tax ledger, invoice, settlement, persistence, or transaction authority is introduced.
