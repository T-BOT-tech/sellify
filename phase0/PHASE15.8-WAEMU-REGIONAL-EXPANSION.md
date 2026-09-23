# SELLIFY PHASE 15.8 — WAEMU REGIONAL EXPANSION

Status: IMPLEMENTED — regional contract only.
Date: 2026-09-09
Source baseline: Phase 15.7 Tanzania Country Overlay

## 1. Purpose

Phase 15.8 adds the West African Economic and Monetary Union (WAEMU/UEMOA) as a reusable regional composition layer. It does not implement individual WAEMU country overlays and does not create any new Core authority.

UEMOA's current official member list contains eight countries: Benin, Burkina Faso, Côte d'Ivoire, Guinea-Bissau, Mali, Niger, Senegal and Togo. UEMOA also documents a common CFA franc (XOF) monetary framework and a common-market/customs integration mandate. citeturn0search1turn0search3turn0search10

## 2. Contract boundary

The WAEMU cluster is represented as:

- region code: `WAEMU`
- member countries: `BJ`, `BF`, `CI`, `GW`, `ML`, `NE`, `SN`, `TG`
- shared language signal: `fr`
- common currency reference: `XOF`
- customs union: `true`
- common market: `true`
- country overlay: mandatory
- implementation status: `contract_only`

The common external tariff is an existing UEMOA regional trade framework and is represented only as regional contract context; Sellify does not implement a customs engine in this phase. citeturn0search0turn0search10

## 3. Currency boundary

XOF is represented as a regional currency reference because UEMOA officially describes the CFA franc as common to its member states and issued by BCEAO. The regional contract does not create a currency ledger, account store, settlement engine, or payment authority. citeturn0search2

## 4. Tax and regulatory boundary

The regional tax strategy is declared as:

`regional_harmonization_plus_country_overlay`

Regional harmonization is metadata/policy composition only. Country-specific tax calculation, filing, invoice requirements and legal obligations remain deferred to future country overlays and existing Core authorities. UEMOA's amended treaty explicitly identifies harmonization of legislation, particularly taxation, as part of the common-market framework. citeturn0search10

## 5. Payment boundary

No new payment provider or regional payment rail is invented. The contract preserves:

`country adapter + regional rail when available`

with execution through the existing payment authority only.

## 6. Authority constraints

WAEMU MUST NOT introduce:

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

No WAEMU country is activated by this phase. The eight country references are membership metadata only. Each future country must pass its own country-pack contract and country security/compliance gates before activation.

## 8. Exit criteria

Phase 15.8 is complete when:

1. WAEMU is represented as a regional cluster.
2. All eight official member-country references are represented exactly once.
3. XOF is represented as a regional currency reference without creating a currency authority.
4. French is represented as the shared language signal without removing country locale overlays.
5. Customs/common-market context remains regional contract metadata.
6. Country overlays remain mandatory.
7. Existing EAC and country packs remain independent.
8. No regional Core authority is introduced.
