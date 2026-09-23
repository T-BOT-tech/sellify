# Phase 13.8.6 — Restaurant Order / Payment Compatibility

## Objective

Connect the existing Restaurant checkout context to the established Core Commerce Order and Core Payment authorities without introducing Restaurant-specific order or payment authorities.

## Authority Boundary

- Restaurant: table, kitchen, recipe, preparation context.
- Core Commerce: canonical Order.
- Core Payment: canonical Payment and payment state machine.
- Core Customer: customer identity.
- Core Location: organization/location scope.

## Implementation

`app/src/verticals/restaurant/order-payment-compatibility.js` is a dependency-light compatibility bridge.

It:

1. Normalizes an existing Restaurant checkout order into the Core Commerce shape.
2. Requires organization and location scope.
3. Validates line totals using existing integer minor-unit money semantics.
4. Preserves table and kitchen context as Restaurant metadata on the canonical order.
5. Converts existing cash/proof fields into the established Core Payment states.
6. Does not create a Restaurant order or Restaurant payment record.
7. Preserves existing payment proof compatibility through `order.payment_proof`.

## Payment State Mapping

- Full cash tendered → `RECEIVED`
- Partial cash tendered → `PARTIAL`
- Payment proof attached → `CLAIMED`
- Otherwise → `UNPAID`

These states are the existing Core Payment states; the bridge does not invent `PAID` or another Restaurant-specific state.

## Idempotency / Persistence

This phase is a compatibility contract. It does not introduce a migration or new persistence authority. Existing Core order synchronization and existing Core payment APIs remain responsible for persistence and lifecycle transitions.

## Explicit Non-Goals

- No `RestaurantOrder`.
- No `RestaurantPayment`.
- No replacement of `orders/checkout.js`.
- No replacement of the Core Payment state machine.
- No new database tables.
