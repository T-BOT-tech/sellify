# Phase 14.4 — Tax Boundary

Status: COMPLETE

## Scope

Establish the Ethiopia country-tax boundary without introducing a tax engine,
tax ledger, invoice tax persistence, or replacing existing Commerce/B2B
invoice authority.

## Ethiopia boundary

- Country: `ET`
- Tax mode: `country_defined`
- Implementation: `deferred`
- Persistence: none
- Calculation authority: not introduced

The country pack declares that tax is country-defined, while the runtime bridge
only exposes that declaration to future country-specific implementation.

## Authorities preserved

- Country metadata: `app/src/country-pack-contract.js`
- Organization country identity: existing organization authority
- Money calculations: `app/src/utils/money.js`
- Commerce/order authority: existing Commerce Core
- B2B invoice authority: existing B2B invoice implementation
- Audit/authorization/event authorities: existing canonical authorities

## Boundary rules

The Phase 14.4 bridge does not create:

- a tax calculation engine;
- a tax-rate database;
- a tax ledger;
- invoice tax persistence;
- a second order/commerce authority;
- country-specific database tables;
- tax-inclusive/exclusive price rewriting;
- silent historical transaction reinterpretation.

Tax implementation remains deferred to a separately approved phase.
