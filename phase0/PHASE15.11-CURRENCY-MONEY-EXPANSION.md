# Phase 15.11 — Currency / Money Expansion

## Status
COMPLETE under the available Node 22.16.0 inspection runtime. Node >=24 remains a separate release-certification gate.

## Objective
Expand currency metadata and minor-unit handling without creating a second money authority, exchange-rate service, ledger, tax authority, payment authority, or invoice authority.

## Implementation
Added `app/src/currency-money-contract.js` as a declarative currency metadata registry for current country packs, regional currencies, and strategic candidates.

Expanded currency symbols in `app/src/constants.js` and extended `app/src/utils/money.js` with new non-2-decimal scales for currencies not yet activated as country packs.

`app/src/country-money-localization.js` now consumes the currency metadata contract while continuing to delegate all calculations to `app/src/utils/money.js`.

### Compatibility rule
Existing XOF storage remains at the project's established 2-decimal scale. The registry records canonical XOF decimal places separately and explicitly marks the legacy storage compatibility boundary. No retroactive data migration is performed.

### Added metadata
ETB, KES, TZS, NGN, GHS, ZMW, XOF, XAF, BIF, CDF, RWF, SOS, SSP, UGX.

## Authority boundaries
The currency layer owns metadata only. It does not own persistence, a money ledger, exchange rates, tax, payments, or invoices. Exchange-rate integration remains deferred to an explicit external adapter boundary.

## Verification
`npm run test:phase15.11` PASS under Node 22.16.0.

The regression verifies metadata completeness, symbols, 0-decimal handling for newly introduced currencies, preservation of existing XOF storage semantics, country-money integration, and fail-closed authority claims.
