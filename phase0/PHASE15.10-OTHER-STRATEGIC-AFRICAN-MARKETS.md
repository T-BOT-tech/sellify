# Phase 15.10 — Other Strategic African Markets

Status: IMPLEMENTED — strategy/candidate contract only.
Date: 2026-09-09
Source baseline: Phase 15.9 CEMAC Regional Expansion

## 1. Purpose

Phase 15.10 establishes a narrow strategy-only contract for African markets that are important to the expansion roadmap but are not yet represented by an active country overlay or regional cluster.

The first candidates are Ghana and Zambia because the Phase 15.4 strategy identifies Ghana as a Tier 1 standalone/regional-reuse candidate and Zambia as a Tier 2 strategic regional expansion candidate.

This phase does not activate either country pack.

## 2. Candidate contract

| Country | Code | Currency | Tier | Status |
|---|---|---|---:|---|
| Ghana | GH | GHS | 1 | candidate_only |
| Zambia | ZM | ZMW | 2 | candidate_only |

The currency references are declarative only. Ghana's Bank of Ghana identifies the cedi as Ghana's legal tender, while the Bank of Zambia identifies the Zambian kwacha (ZMW) as the country's official currency/legal tender. No currency ledger or settlement authority is introduced.

## 3. Regional boundary

These markets are represented under the continental `AfCFTA` context only. This does not replace EAC, WAEMU, CEMAC, or country-specific rules and does not create a continental commerce authority.

## 4. Activation boundary

Each candidate remains `candidate_only` and requires a future country overlay gate before activation. Future activation must preserve the existing sequence:

`Add → Dual-read → Dual-write → Verify → Switch → Deprecate → Remove`

where applicable, and must reuse existing Core authorities rather than introducing country-specific duplicates.

## 5. Forbidden authority claims

The strategy contract must not own:

- persistence
- commerce
- inventory
- payments
- identity
- authorization
- audit
- events
- tax ledger
- invoice authority

## 6. Exit criteria

1. Ghana and Zambia are represented exactly once as strategy candidates.
2. Currency and language signals remain declarative.
3. No country overlay is activated.
4. AfCFTA remains contextual only.
5. Existing ET/KE/TZ/NG country packs remain independent.
6. Existing EAC/WAEMU/CEMAC regional clusters remain independent.
7. Forbidden authority claims fail closed.
