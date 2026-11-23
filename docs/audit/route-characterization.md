# Route characterization

Baseline `e216db18ade2a5ffa66aff9dc3096e207251a918`; source `backend/server.js` blob `a4a5abdcaae344252fba26c600406829c4e98bce`.

## Inventory totals

- **253** route entries: **247** explicit `ROUTES` entries and **6** pre-dispatch entries (five intentional inline/static handlers plus `/health` infrastructure).
- **137** distinct named handlers; **0** unresolved handler references and **0** duplicate explicit method/pattern keys.
- Named handler source spans resolve; `/health` is intentionally inline.
- Classification: **229** domain-capability, **13** mixed, **6** infrastructure and **5** inline/static.
- Methods: GET 120, POST 102, PATCH 28, PUT 2, ANY 1.
- The earlier heuristic's 35 unclassified entries were not broken handlers: 30 real routes needed better classification and five were intentional inline/static handlers.
- **166** entries are method-conditional. **153** route entries use handlers registered for multiple methods. The JSON now separates registered route methods from explicit `req.method` branches and fallback methods; dependency and validation evidence remains handler-wide unless a branch is isolated.

## Perplexity inventory cross-check

The current-main `Perplexity audit inventory` workflow (run `45254875666`, Node 24, on this baseline) passed its route and store inventory regression steps. Its scripts are useful independent coverage checks, but their limits matter: `perplexity-server-route-inventory.mjs` deduplicates method/pattern keys inside `addRoute()` before the classification script calculates `duplicateCount`. Therefore that workflow's zero duplicate count cannot detect duplicate source entries that were discarded. This route map independently counts all 247 explicit source entries and found zero duplicate keys. The Perplexity route gate also checks handler binding, not authentication, authorization, scope, transactions or side effects.

## Route-to-store dependency map

- **873** direct route-to-store references across **196** distinct exported store functions.
- **790** references join to SQL table/operation evidence; **83** have no SQL in their exported function span and may be wrappers, helper delegates or pure projections.
- **90** distinct tables are reached through direct exported store functions. Transitive exported functions, internal-helper SQL candidates and PaymentCore-delegated store calls are represented separately.
- Each matched store dependency now includes tables, operation types, SQL statement count, transaction markers, called exported functions, internal helper names and provisional area hints. Empty direct SQL tables do not mean the function has no persistence effect; inspect the separate helper/delegation fields.
- PaymentCore routes include the delegated method, its permission expression, called store functions, SQL tables, operations and transaction markers. This closes the previous gap where PaymentCore-mediated persistence was invisible in the HTTP route map.

## Authentication and authorization

The dispatcher rate-limits before dispatch but does **not** provide universal session/auth middleware. Authentication and authorization are established at handler, delegated capability, store or public/token boundary.

The detailed source scan records **205 route entries with explicit permission keys**, **201 route entries with handler authorization calls**, **158 unique handler helper call sites**, and **28 delegated PaymentCore methods**. Three entries remain in the security review queue.

The JSON records:
- `requireAuthorization` and `requireOwnerRole` calls with source line and arguments;
- courier ownership, location and event-tenant scope helpers;
- explicit permission literals and locally resolvable permission expressions;
- PaymentCore `#authorize` checks and delegated store functions;
- store-level action/scope helpers, distinguishing membership validation from an action permission.

The categories overlap. Public projections, signed identity flows, provider notifications, one-time challenges, admin bearer routes and self-service session operations are not expected to carry a tenant business permission in the same way as an organization mutation.

### Security review queue

**Three route entries need explicit policy clarification or remediation review:**

1. `POST /sync/:chatId` — session authentication only, then `saveQueuedOrders` writes canonical orders and ensures canonical Payment state. The store function accepts no actor and has no role-permission check. The central role policy contains `orders:create` and `sync:manual`; confirm intended device-role access and enforce the applicable permission if restricted. Source: `backend/server.js:1221-1243`, `backend/lib/store-sqlite.js:12172-12270`.
2. `GET /tenants/:chatId/payments/routing/policies` — session authentication only; direct store list function is tenant/organization scoped but has no action-level authorization. The role policy exposes `payments:view`, which this route does not evaluate.
3. `POST /tenants/:chatId/payments/routing/policies` — session authentication only; direct store upsert function persists routing policy without action-level authorization. The role policy exposes `payments:route`; `PaymentCore.resolveRouting` checks it, but this HTTP handler bypasses that method. Source: `backend/server.js:2397-2411`, `backend/lib/store-sqlite.js:9717-9762`, `backend/lib/payments/payment-core.js:25-29`.

The membership-list and logout endpoints are self-service and session-scoped. Public/token-scoped projections and provider/identity-authenticated routes are separately classified; missing tenant permission keys on those routes are not automatically defects.

## Validation, errors, idempotency and transactions

For each route entry, the JSON records handler source span, validation excerpts and line evidence where resolved, explicit status/error codes, idempotency references, direct and delegated store functions, SQL tables/operations, transaction markers, side-effect hints and test filename candidates.

- Thrown handler errors are mapped by the dispatcher to `e.statusCode || 500`; unmatched GET may fall through to static serving, while unmatched non-GET returns 404.
- A handler without a transaction marker may call a transactional store function; direct and delegated transaction evidence is listed separately.
- A shared handler's store/validation/error evidence is a union of the handler body. Use `methodBranchCoverage` before attributing a side effect to one HTTP method.
- Filename-based test candidates are search leads, not proof. Open each test and confirm route, method, auth, scope, idempotency, failure and side-effect assertions.

## Classification and extraction decision

Classification distinguishes domain capability, mixed cross-domain/channel boundary, infrastructure and inline/static. It is not a canonical ownership assignment. URL prefixes, Pack names and handler names are not safe extraction boundaries.

**No route extraction is approved.** Complete method-specific authorization and branch behavior review first; preserve existing transaction owners and canonical authorities.
