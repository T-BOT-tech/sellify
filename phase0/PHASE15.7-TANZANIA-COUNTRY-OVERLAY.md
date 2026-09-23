# PHASE 15.7 — TANZANIA COUNTRY OVERLAY / EAC EXPANSION

Status: IMPLEMENTED — additive country identity / locale overlay.

## Scope

Tanzania is the first implementation selected by the Phase 15.6 EAC priority gate. The implementation is deliberately limited to the existing country-pack contract plus a runtime identity/locale projection.

Implemented:

- Country code: `TZ`
- Currency: `TZS`
- Locale contract: `en-TZ`
- Supported locale languages: `en`, `sw`
- Timezone fallback: `Africa/Dar_es_Salaam`
- Country aliases: `tz`, `tanzania`, `united republic of tanzania`
- Payment provider declaration: empty/deferred because no Tanzania provider is added to the existing provider registry in this phase.

The currency and country-code facts are consistent with the Bank of Tanzania and African Union references; Tanzania uses the Tanzanian shilling (TZS). The Tanzania Embassy country profile also records ISO code `TZ`, +255, UTC+3, and Swahili/English. The runtime timezone uses the IANA `Africa/Dar_es_Salaam` identifier. See implementation research references retained in the Phase 15.7 handoff.

## Authority boundary

Tanzania remains a country overlay only. It does not create:

- country persistence
- commerce authority
- inventory authority
- payment authority
- customer identity authority
- authorization authority
- audit authority
- event authority
- tax ledger
- invoice authority
- regional persistence

The EAC regional cluster remains the composition layer. The country overlay remains mandatory.

## Migration discipline

No existing country pack was rewritten or removed. Tanzania was added additively. Historical Phase 15.1/15.2/15.3 tests that assert earlier exact country-pack lists remain immutable historical baselines.

## Regression

`phase0/phase15.7-tanzania-country-identity-regression.mjs` validates:

- Tanzania identity activation
- `TZ` / `TZS` mapping
- English/Swahili locale boundary
- timezone fallback behavior
- explicit organization currency/timezone precedence
- fail-closed non-Tanzania behavior
- payment provider declaration remains empty/deferred
- EAC membership remains regional composition-only
- no duplicate identity authority
