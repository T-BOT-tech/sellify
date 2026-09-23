# PHASE 15.6 — COUNTRY PRIORITY & SEQUENCING GATE

Status: COMPLETE as a strategy-only gate under Node 22.16.0. Node >=24 remains a separate release certification gate.

## Purpose

Select the next EAC country implementation order after the regional cluster contract, without creating country persistence or activating payment/tax integrations.

## Current evidence boundary

The EAC officially lists eight Partner States: Burundi, Democratic Republic of the Congo, Kenya, Rwanda, Somalia, South Sudan, Tanzania and Uganda. Kenya is already implemented in Sellify, so this gate scores the seven remaining countries. The EAC reports an estimated 331.1 million citizens and describes the Customs Union, Common Market and Monetary Union as integration milestones. The Customs Union includes free intra-EAC trade subject to rules of origin and a common external tariff; the Common Market supports regional movement and trade. These facts support a regional-first architecture but do not establish country-level tax/payment readiness.

World Bank 2025 population data used as TAM context show Tanzania 70.55M, Uganda 51.38M, Rwanda 14.57M, Burundi 14.39M, South Sudan 12.19M and Somalia 19.65M; the DRC value is maintained as a strategy candidate but is not assigned an unsupported population figure in this gate. Kenya is 57.53M and is already installed.

## Scoring model

| Dimension | Weight |
|---|---:|
| TAM / population | 20% |
| Currency reuse | 15% |
| Language reuse | 10% |
| Regulatory / tax alignment | 25% |
| Regional trade integration | 15% |
| Payment ecosystem reuse | 10% |
| Implementation complexity | 5% |

Scores are internal decision-support assessments on a 0-to-weight scale. They are not legal, tax, payment, market-size or operational claims. Before implementation, country-specific evidence must be revalidated.

## Recommended sequence

| Rank | Country | Code | Score / 100 | Decision |
|---:|---|---|---:|---|
| 1 | Tanzania | TZ | 86 | Next candidate |
| 2 | Uganda | UG | 83 | Next candidate |
| 3 | Rwanda | RW | 74 | Follow-on |
| 4 | Burundi | BI | 56 | Later |
| 5 | DRC | CD | 54 | Dedicated overlay required |
| 6 | Somalia | SO | 41 | Later |
| 7 | South Sudan | SS | 40 | Later |

## Architectural decision

The score does NOT authorize implementation. A country can enter implementation only after a dedicated country-overlay phase confirms:

1. country identity and locale;
2. currency and money rules;
3. tax boundary;
4. documents/invoices;
5. phone/address rules;
6. payment adapter identifiers and operational readiness;
7. compliance requirements;
8. country security/isolation;
9. country events/outbox integration;
10. regression and Node >=24 release gates.

No regional or country layer may own Core commerce, inventory, payments, customer identity, authorization, audit, event persistence, tax ledger or invoice authority.

## Source references

- EAC Overview: https://www.eac.int/overview-of-eac
- EAC Customs Union: https://www.eac.int/customs-union
- EAC Trade: https://www.eac.int/trade
- World Bank WDI comparison: https://databank.worldbank.org/reports.aspx?country=BDI%2CKEN%2CCOD%2CETH%2CRWA%2CTZA%2CSOM%2CUGA&source=2
- World Bank Kenya/Tanzania/Uganda comparison: https://data.worldbank.org/?locations=KE-TZ-UG

External evidence is contextual only; Sellify's implementation authority remains its canonical Core and country-overlay contracts.
