# SELLIFY PHASE 15.9 — CEMAC REGIONAL EXPANSION

Status: IMPLEMENTED — regional contract only.
Date: 2026-09-09
Source baseline: Phase 15.8 WAEMU Regional Expansion

## 1. Purpose

Phase 15.9 adds the Central African Economic and Monetary Community (CEMAC) as a reusable regional composition layer. It does not implement individual CEMAC country overlays and does not create any new Core authority.

CEMAC's official member list contains six countries: Cameroon, Central African Republic, Chad, Congo, Equatorial Guinea and Gabon. CEMAC describes its mission as progressing toward a genuine common market. BEAC confirms the six-member monetary union and its common currency role.

## 2. Contract boundary

The CEMAC cluster is represented as:

- region code: `CEMAC`
- member countries: `CM`, `CF`, `TD`, `CG`, `GQ`, `GA`
- shared language signal: `fr`
- common currency reference: `XAF`
- customs union: `true`
- common market: `true`
- country overlay: mandatory
- implementation status: `contract_only`

The customs/common-market properties are regional framework metadata only; Sellify does not implement a customs engine in this phase.

## 3. Currency boundary

XAF is represented as a regional currency reference because CEMAC members share the Central African CFA franc under the regional monetary framework. The regional contract does not create a currency ledger, account store, settlement engine, or payment authority.

## 4. Tax and regulatory boundary

The regional tax strategy is declared as:

`regional_harmonization_plus_country_overlay`

Regional harmonization is metadata/policy composition only. Country-specific tax calculation, filing, invoice requirements and legal obligations remain deferred to future country overlays and existing Core authorities.

## 5. Payment boundary

No new payment provider or regional payment rail is invented. The contract preserves:

`country adapter + regional rail when available`

with execution through the existing payment authority only.

## 6. Authority constraints

CEMAC MUST NOT introduce:

- regional orders
- regional inventory ledgers
- regional payment ledgers
- regional customer identity
- regional authorization stores
- regional audit stores
- regional event stores/brokers
- regional tax ledgers
- regional invoice authority
- regional persistence

The architecture remains:

`Core Authority → Regional Contract → Country Overlay → Existing Adapter/Provider`

## 7. Country overlay rule

No CEMAC country is activated by this phase. The six country references are membership metadata only. Each future country must pass its own country-pack contract and country security/compliance gates before activation.

## 8. Exit criteria

Phase 15.9 is complete when:

1. CEMAC is represented as a regional cluster.
2. All six official member-country references are represented exactly once.
3. XAF is represented as a regional currency reference without creating a currency authority.
4. French is represented as the shared language signal without removing country locale overlays.
5. Customs/common-market context remains regional contract metadata.
6. Country overlays remain mandatory.
7. Existing EAC and WAEMU clusters remain independent.
8. No regional Core authority is introduced.
