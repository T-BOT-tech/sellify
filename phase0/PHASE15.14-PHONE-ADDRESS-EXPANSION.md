# Phase 15.14 — Phone / Address Expansion

## Boundary

Expand the existing Phase 14.6 phone/address boundary from Ethiopia-only metadata to the active country packs, strategic candidates, and country overlays represented by the EAC, WAEMU, and CEMAC regional contracts.

## Implementation

`app/src/country-phone-address-rules.js` remains a declarative boundary. It provides country calling-code metadata, E.164 representation posture, and a country-defined address/postal-code boundary. Exact country-specific validation remains deferred.

The existing Ethiopia hierarchy (`region → zone → woreda → kebele`) is preserved exactly. Other countries intentionally use `country_defined` administrative hierarchy metadata rather than inventing legal/local address structures.

## Architecture

- Customer identity remains the existing customer authority.
- Organization identity remains the existing organization authority.
- Address persistence remains outside this module.
- Phone persistence remains outside this module.
- Geocoding remains outside this module.
- No regional address authority is introduced.
- No route/geocoding engine is introduced.
- Country overlays remain mandatory for regional signals.

## Coverage

- Active: ET, KE, TZ, NG
- Strategic candidates: GH, ZM
- EAC: BI, CD, KE, RW, SO, SS, TZ, UG
- WAEMU: BJ, BF, CI, GW, ML, NE, SN, TG
- CEMAC: CM, CF, TD, CG, GQ, GA

Regional membership is composition-only; country-level phone/address rules remain the execution boundary. EAC currently identifies eight Partner States. UEMOA identifies eight member states. CEMAC identifies six member states.

## Regression

`phase0/phase15.14-phone-address-expansion-regression.mjs`

The regression verifies:

1. Ethiopia compatibility is preserved.
2. Active and candidate country calling-code boundaries resolve.
3. EAC/WAEMU/CEMAC country overlays resolve independently.
4. E.164 remains the representation boundary.
5. Administrative hierarchy remains country-defined unless already explicitly established.
6. No persistence, identity, phone/address ownership, or geocoding authority is introduced.
7. Unknown countries fail closed.

## Sources

Regional membership was checked against current official EAC, UEMOA, and CEMAC sources during implementation. EAC currently lists eight Partner States; UEMOA lists eight member states; CEMAC lists six member countries.
