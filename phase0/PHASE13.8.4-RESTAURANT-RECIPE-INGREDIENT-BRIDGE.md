# Phase 13.8.4 — Restaurant Recipe / Ingredient Bridge

## Purpose

Formalize Restaurant `Recipe` ingredients as references to existing Core Commerce Products while preserving Core Inventory as the sole stock authority.

## Boundary

- Restaurant owns: `Recipe`, `Preparation` semantics.
- Commerce owns: Product identity/catalog.
- Inventory owns: stock quantity and mutation.
- Canonical movement ledger remains `app/src/warehouse/ledger.js`.

## Behavior

`normalizeRecipe()` validates organization scope, requires existing Core Products, rejects duplicate ingredient products, and normalizes quantity/unit data. It is persistence-neutral.

No inventory mutation occurs in Phase 13.8.4. Actual ingredient consumption is explicitly deferred to Phase 13.8.5.

## Prohibited

- No `RestaurantProduct`.
- No `RestaurantInventory`.
- No recipe-specific stock ledger.
- No direct stock mutation.
- No duplicate product authority.

## Verification

Run:

```bash
npm run phase13.8.4:restaurant-recipe-test
```

Then run the complete Phase 12.8 regression gate and all Phase 13 targeted tests.
