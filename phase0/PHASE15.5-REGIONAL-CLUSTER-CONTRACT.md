# PHASE 15.5 — REGIONAL CLUSTER CONTRACT

Status: COMPLETE — declarative regional architecture contract.

## Purpose

Phase 15.5 introduces a reusable regional-cluster boundary before adding more country packs. The regional layer groups countries that share meaningful integration frameworks while preserving country overlays for local currency, tax, documents, language, phone/address, payments and compliance.

## Implemented contract

`app/src/regional-cluster-contract.js`

The contract defines:

- stable regional identity;
- member-country set;
- shared language signals;
- currency strategy;
- trade/customs framework;
- tax harmonization strategy;
- payment adapter strategy;
- mandatory country overlay;
- contract-only implementation status.

## Initial cluster: EAC

The EAC cluster is modeled as:

- `BI` — Burundi
- `CD` — Democratic Republic of the Congo
- `KE` — Kenya
- `RW` — Rwanda
- `SO` — Somalia
- `SS` — South Sudan
- `TZ` — Tanzania
- `UG` — Uganda

The member set follows the current EAC source material. The contract deliberately does not assign a regional currency: each country remains responsible for its country currency until a future regional monetary implementation is explicitly approved.

Shared language metadata is limited to `en` and `sw` as reusable regional signals; this does not mean every member country has identical language requirements. Country packs remain authoritative for their own locale configuration.

## Authority boundary

The regional cluster MUST NOT own:

- commerce/orders;
- inventory or stock movement;
- payment state or payment ledger;
- customer identity;
- authorization/roles;
- audit history;
- event persistence or brokers;
- tax ledger;
- invoice numbering or invoice authority;
- country persistence.

Regional behavior is composed through:

`Regional Cluster → Country Overlay / Existing Core Capability → Adapter → Provider`

## Currency rule

The EAC contract uses `country_currency`. It does not invent or persist an EAC common currency. Any future monetary-union implementation requires a separate approved phase and evidence gate.

## Tax rule

The regional layer records `regional_harmonization_plus_country_overlay`. It does not calculate tax, own tax state, or replace the existing tax/invoice authorities.

## Payment rule

The regional layer describes payment composition only. Execution remains behind the existing payment authority and provider/channel registries. No regional payment credentials, ledger, webhook store, or reconciliation authority is introduced.

## Country overlay rule

Every country remains a required overlay. A regional cluster may supply reusable framework metadata, but it cannot erase local country differences.

## Regression gate

The Phase 15.5 regression must prove:

1. EAC resolves correctly.
2. The eight current EAC members are represented exactly once.
3. Currency remains country-specific.
4. Country overlay is mandatory.
5. Forbidden authority claims fail closed.
6. No persistence is introduced.
7. The existing country-pack contract remains compatible.

Node >=24 remains a separate release certification gate.
