# Phase 11.1 — Money Contract

Status: implemented additively.

## Objective

Establish the canonical Commerce money boundary without replacing Sellify's existing integer minor-unit implementation.

## Contract

```ts
Money {
  amount_minor: integer;
  currency: string; // ISO-style 3-letter uppercase code
}
```

The existing `price_minor` and `total_minor` columns remain authoritative. No floating-point monetary source of truth is introduced.

## Changes

- Migration `12` adds `currency` to `catalog_products` and `orders`.
- Existing rows inherit currency from the tenant's canonical organization/branding currency.
- Catalog responses expose explicit currency.
- Synced orders persist explicit currency and reject a currency that differs from the organization currency.
- Marketplace seller orders persist explicit currency.
- Marketplace checkout rejects a multi-seller cart containing different currencies rather than silently converting money.
- Organization currency changes are rejected after monetary catalog/order records exist, preventing historical ambiguity.
- Currency input is normalized to uppercase three-letter codes with `ETB` as the compatibility fallback.

## Compatibility

- Existing order/catalog sync routes remain unchanged.
- Existing minor-unit numeric fields remain unchanged.
- Existing marketplace checkout remains transactional.
- Existing tenant, organization, authorization, inventory, outbox, and audit contracts remain intact.

## Migration discipline

```text
add migration 12
→ backfill currency
→ validate new writes
→ preserve old API shape
→ test
```

Historical migrations are not edited.

## Validation

- Phase 11.1 Money Contract Regression: PASS
- Phase 0 Golden Regression: 20 PASS / 0 FAIL
- Phase 10.3 Authorization Regression: PASS
- Phase 10.5 Inventory Ledger Regression: PASS
- Phase 10.6 Multi-Location Regression: PASS
- Phase 10.7 Outbox/Event Regression: PASS
- Phase 10.7 Compliance/Audit Regression: PASS
- JavaScript syntax checks: PASS

## Next

Phase 11.2 — Payment Core.
