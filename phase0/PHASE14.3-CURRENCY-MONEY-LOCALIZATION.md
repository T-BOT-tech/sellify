# Phase 14.3 — Currency / Money Localization

Status: COMPLETE

## Scope

Phase 14.3 establishes a country-pack currency projection over the existing Core money implementation. Ethiopia resolves to ETB while existing Core authorities remain unchanged.

## Authorities preserved

- Country/currency metadata: `app/src/country-pack-contract.js`
- Organization country/currency identity: existing organization authority
- Money conversion/formatting: `app/src/utils/money.js`
- Currency symbols: `app/src/constants.js`
- Ethiopia identity/locale projection: `app/src/ethiopia-country-identity.js`

## Ethiopia contract

- Country: `ET`
- Currency: `ETB`
- Symbol: existing `Br ` symbol
- Decimal places: existing 2-decimal ETB minor-unit behavior
- Decimal separator: `.`
- Grouping separator: `,`

## Boundary rules

The Phase 14.3 bridge does not create:

- a second money representation;
- a country money ledger;
- exchange-rate authority;
- tax authority;
- country-specific money persistence;
- a replacement for the existing money utilities.

Existing money behavior is preserved. Any future currency-scale migration must be a separate, deliberate migration and must not silently reinterpret stored amounts.

## Regression

`npm run test:phase14.3` PASS.

The existing Phase 14.2 regression also remains PASS.

The pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning is unchanged and does not affect this phase's assertions.
