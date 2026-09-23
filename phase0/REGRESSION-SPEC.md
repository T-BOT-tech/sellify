# Sellify Phase 0 — Golden Regression Specification

This is the behavior that must remain true while Phase 10+ is introduced.

## A. Boot

- Static app serves successfully.
- Backend starts under supported Node runtime.
- `/health` returns `ok: true`.
- Database migrations execute without corruption.

## B. Identity / access

- Existing Telegram authentication remains functional.
- Existing tenant selection remains functional.
- Existing device pairing remains functional.
- Existing session logout/revocation remains functional.
- Existing invitation flow remains functional.
- Unauthorized tenant access remains denied.

## C. Products / inventory

- Product creation/editing works.
- Product price validation remains active.
- Stock cannot become negative through supported mutation paths.
- Warehouse adjustment/receive flows remain functional.

## D. Orders

- Local/offline order creation works.
- Queued orders remain queued while offline.
- Sync succeeds when connectivity returns.
- Server-side order total recomputation remains active.
- Malformed orders can be rejected without infinite retry.
- Existing order history remains readable.

## E. Marketplace

- Catalog search works.
- Checkout validates price and stock.
- Stock decrement and seller-order creation remain atomic.
- Marketplace order tracking remains functional.
- Marketplace status updates remain authorized.

## F. B2B / verticals

- B2B accounts and pricing remain usable.
- Restaurant table/kitchen operations remain usable.
- Warehouse locations remain usable.
- Logistics fulfillment state remains usable.

## G. Offline/PWA

- IndexedDB persistence works.
- localStorage fallback remains available.
- Hydration restores state.
- Service worker behavior remains intact.
- Existing exports remain redacted as designed.

## H. Data safety

- Existing migrations are forward-only and repeat-safe.
- Existing legacy JSON import does not destroy source files.
- SQLite backups can be created.
- Audit events remain append-oriented.

## I. Phase 0 test rule

Any Phase 10 change that breaks one of these behaviors must either:

1. be fixed before merge; or
2. have an explicit, reviewed migration plan explaining the intentional behavior change.
