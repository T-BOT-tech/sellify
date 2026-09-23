# SELLIFY PHASE 15.4 — COUNTRY EXPANSION STRATEGY & REGIONAL MARKET ARCHITECTURE

Status: IMPLEMENTED — strategy/architecture gate
Date: 2026-09-09
Source baseline: Phase 15.3 Nigeria Country Pack Identity

## 1. Purpose

Phase 15.4 establishes the strategic layer that must precede additional country implementation. Sellify must not expand as an isolated sequence of country packs when multiple countries can reuse regional currency, language, trade, tax, payment, customs, and compliance structures.

The country pack remains the final country overlay. Regional structures become reusable composition layers above it.

## 2. Architectural rule

```text
SELLIFY GLOBAL COMMERCE
        |
        +-- Core Authorities
        |
        +-- Continental Trade Layer (AfCFTA-aware)
        |
        +-- Regional Market Layer
        |      +-- EAC
        |      +-- WAEMU/UEMOA
        |      +-- CEMAC
        |
        +-- Shared Capability Layers
        |      +-- Currency / Money
        |      +-- Language / Locale
        |      +-- Tax / Regulatory Framework
        |      +-- Payment Adapter Framework
        |      +-- Trade / Customs
        |      +-- Compliance
        |
        +-- Country Overlay
               +-- ET
               +-- KE
               +-- NG
               +-- future countries
```

Regional layers are adapters/configuration and policy composition. They do not become new commerce, inventory, payment, customer, fulfillment, authorization, audit, or event authorities.

## 3. Regional clusters

### EAC — first priority regional architecture

EAC has an established Customs Union, Common Market, and Monetary Union framework. Its Customs Union includes free-trade objectives within the region and a Common External Tariff; the Common Market covers movement of goods, persons, labour, services and capital. EAC also identifies harmonisation of trade policies, standards, customs information and procedures as integration mechanisms.

Sellify consequence: build an EAC regional contract once, then attach country overlays rather than duplicating the same trade and regional metadata per country.

Primary sources:
- https://www.eac.int/customs-union
- https://www.eac.int/common-market
- https://www.eac.int/customs/objectives
- https://www.eac.int/

### WAEMU / UEMOA — second regional architecture candidate

WAEMU should be modelled as a regional monetary, customs, tax and regulatory reuse candidate. XOF currency reuse is potentially significant, but each country still requires a country overlay for local tax, invoicing, language, address, phone, compliance and payment differences.

Implementation rule: do not infer identical country rules merely because countries share a monetary framework.

### CEMAC — third regional architecture candidate

CEMAC should be modelled as another regional monetary/customs/regulatory reuse candidate. XAF is a regional currency layer, while country-specific legal, tax, language, payment and compliance differences remain overlays.

### AfCFTA — continental umbrella

AfCFTA is treated as a continental trade context, not as a replacement for regional or country rules. Sellify should use it for cross-region trade metadata and policy composition while retaining the authority boundary of each regional/country layer.

## 4. Country prioritisation model

Candidate priority is evaluated using:

| Dimension | Weight |
|---|---:|
| TAM / population | 20% |
| Currency reuse | 15% |
| Language reuse | 10% |
| Regulatory / tax alignment | 25% |
| Regional trade integration | 15% |
| Payment ecosystem reuse | 10% |
| Implementation complexity | 5% |

The score is a decision aid, not an automatic deployment trigger. A country must also pass architecture, legal/compliance, payment readiness and operational feasibility gates.

## 5. Strategic country tiers

### Tier 1 — regional reuse candidates

- Uganda
- Tanzania
- Rwanda
- Burundi
- Ghana
- Côte d’Ivoire
- Senegal

These countries represent strong candidates for regional-cluster reuse. Exact implementation order must be determined by the later priority gate rather than assumed from this list.

### Tier 2 — strategic regional expansion

- Zambia
- Cameroon
- Democratic Republic of the Congo
- additional EAC / WAEMU / CEMAC candidates after evidence review

### Tier 3 — global-market overlays

- United Kingdom
- India
- South Africa
- Egypt
- Morocco
- Algeria

These remain strategically important, but should generally follow establishment of the regional architecture rather than interrupting it with isolated country implementations.

## 6. Reuse matrix

| Layer | Regional reuse | Country overlay | Core authority |
|---|---|---|---|
| Currency | Yes where genuinely shared | currency/account specifics | Core money authority |
| Language | Yes | locale fallback/local variants | Existing i18n |
| Tax | Framework only | rates/rules/filing specifics | Core transaction/invoice authority |
| Documents | Templates/metadata | local legal fields | Existing invoice/document authority |
| Phone | Numbering family | national rules | Existing customer authority |
| Address | hierarchy concepts | country-specific fields | Existing location/customer authority |
| Payments | adapter family | provider/channel config | Existing payment authority |
| Customs | regional framework | country execution | Existing commerce/fulfillment authorities |
| Compliance | regional policy framework | country obligations | Existing audit/compliance authority |
| Events | regional metadata | country metadata | Existing outbox authority |

## 7. Critical architectural constraint

A regional pack MUST NOT introduce:

- regional orders
- regional inventory ledgers
- regional payment ledgers
- regional customer identity
- regional fulfillment state
- regional authorization stores
- regional audit stores
- regional event stores/brokers
- duplicate tax ledgers
- duplicate invoice authorities

Regional layers compose existing authorities.

## 8. Implementation sequence

```text
15.4 Country Expansion Strategy                     DONE
        |
15.5 Regional Cluster Contract                      NEXT
        |
15.6 Country Priority & Sequencing Gate
        |
15.7 EAC Regional Expansion
15.8 WAEMU Regional Expansion
15.9 CEMAC Regional Expansion
        |
15.10 Other Strategic African Markets
        |
15.11 Currency / Money Expansion
15.12 Tax Boundary Expansion
15.13 Document / Invoice Expansion
15.14 Phone / Address Expansion
15.15 Payment Adapter Expansion
15.16 Compliance Expansion
15.17 Country Security / Isolation Expansion
15.18 Country Events / Outbox Expansion
        |
15.19 Cross-Region Integration
15.20 Cross-Country Regression Gate
15.21 Node >=24 Full Regression
15.22 Hashes + Final Snapshot
```

This sequence supersedes the earlier proposal to immediately implement UK as Phase 15.4 and India as Phase 15.5. Those earlier numbers were provisional planning only.

## Phase 15.10 candidate-market boundary

Phase 15.10 formalizes a strategy-only candidate registry for other strategic African markets. Ghana (`GH` / `GHS`) is treated as a Tier 1 standalone African market candidate and Zambia (`ZM` / `ZMW`) as a Tier 2 candidate. Neither is activated by the registry. AfCFTA is contextual only; country overlays and existing Core authorities remain mandatory.

## 9. Phase 15.5 contract target

The next phase must define a declarative regional contract with:

- region code and name
- member-country references
- currency references
- language/locale references
- customs/trade capabilities
- tax/regulatory framework references
- payment adapter families
- document framework references
- compliance framework references
- country-overlay requirements
- effective-status metadata
- source/evidence references

It must remain non-persistent unless an existing Core authority already provides the required persistence.

## 10. Exit criteria

Phase 15.4 is complete when:

1. Regional-first expansion is documented.
2. EAC, WAEMU and CEMAC are treated as reusable regional candidates.
3. AfCFTA is treated as a continental umbrella rather than a replacement authority.
4. Country overlays remain distinct from regional frameworks.
5. Country prioritisation is weighted and evidence-driven.
6. No regional duplicate Core authority is introduced.
7. The next implementation phase is a regional contract, not another isolated country pack.
