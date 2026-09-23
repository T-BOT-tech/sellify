# Phase 15.15 — Payment Adapter Expansion

Status: COMPLETE under the available Node 22 inspection/runtime environment. Node >=24 certification remains a separate release gate.

## Boundary

This phase expands country-to-provider mapping only. Existing `backend/lib/payments/provider-registry.js` and `backend/lib/payments/channel-registry.js` remain authoritative. No country pack or regional cluster executes, persists, reconciles, or owns payment state.

## Mappings

- Ethiopia: telebirr, cbe
- Kenya: mpesa
- Tanzania: mpesa
- Nigeria: provider deferred
- Ghana: candidate/provider deferred
- Zambia: candidate/provider deferred

Kenya and Tanzania M-Pesa are represented as mappings to the existing `mpesa` registry entry; the registry entry remains unconfigured, so integration stays deferred. No provider credentials or API implementation were added.

## Architecture

`Country Mapping → Existing Payment Adapter Registry → Provider`

Regional payment execution remains `existing_payment_authority_only`, and every country overlay remains mandatory.

## Explicitly not introduced

- payment ledger
- payment persistence
- provider credentials
- payment orchestration engine
- FX authority
- settlement authority
- new payment provider implementation
- regional payment store

## Verification

The Phase 15.15 regression verifies existing Ethiopia behavior, Kenya/Tanzania mapping to the existing provider registry, deferred Nigeria/Ghana/Zambia coverage, country isolation, and no duplicate payment authority.
