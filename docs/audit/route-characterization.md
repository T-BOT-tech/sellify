# Route characterization

Baseline `e216db18ade2a5ffa66aff9dc3096e207251a918`; source `backend/server.js` at blob `a4a5abdcaae344252fba26c600406829c4e98bce`.

## Inventory totals

- **253** route entries: **247** explicit `ROUTES` entries, **5** intentional inline/static handlers, and the separate `/health` infrastructure endpoint.
- **137** distinct named handler functions across the explicit route table.
- Handler source spans resolved for all 247 named route handlers; inline handlers are separately identified.
- Classification: 229 domain-capability entries, 13 mixed/channel-boundary entries, 6 infrastructure entries, and 5 inline/static entries.
- Direct imported SQLite store dependencies mapped for 243 entries, with 873 direct store-function call references.

## Authentication and authorization evidence

The dispatcher rate-limits before route dispatch (POST/PATCH write budget; other methods read budget), but does **not** apply universal session/auth middleware. Handler or delegated boundaries establish trust. Source extraction found: 224 route entries using tenant-scoped sessions; 187 using central authorization; 12 signed Telegram identity paths; 4 bearer-credential paths; 3 one-time challenge/invite paths; and 7 explicitly public or token-scoped buyer/read surfaces. These categories overlap and are not additive.

Literal `requireAuthorization` permission keys were captured for 166 route entries. Another 17 entries expose helper-based policies such as `requireOwnerRole`, invite-role restrictions, device self-revocation, or logistics assignment checks. **166 entries are method-conditional**: a shared handler may apply different policy by HTTP method. The JSON therefore records handler method branches and does not imply every key applies to every method.

The seven public/token-scoped surfaces are country-pack options, public catalog read, published Telegram storefront metadata, marketplace search, discovery products, discovery organizations, and marketplace order tracking (tracking-token scoped). Payment provider notifications are a separate provider-authentication path: PaymentCore invokes the provider adapter's `authenticateNotification`; the generic adapters currently declare this capability false and fail closed rather than accepting a caller-provided authentication assertion.

## Validation, errors, idempotency, transactions and tests

Per route, the JSON captures input-validation source lines, explicit status/error codes, success status codes, idempotency references, direct store functions, store-level idempotency evidence, transaction markers, side-effect hints and test filename candidates. 70 route entries have direct store dependencies with idempotency/command identity evidence. 46 have explicit handler error codes. 210 have filename-based test candidates; 43 do not. **These candidate matches are not proof of coverage**; tests must be opened and mapped to the actual route contract before certification.

The dispatcher maps thrown handler errors to `e.statusCode || 500`; unmatched GET may fall through to static serving, and unmatched non-GET returns 404. Store transaction boundaries are linked per route through the SQLite dependency inventory; the route handler's lack of a transaction marker does not mean no transaction exists.

## Classification and extraction decision

Classification distinguishes domain capability from mixed channel/cross-domain boundaries, infrastructure and intentional inline/static handlers. It is not a canonical ownership assignment. The prior heuristic's 35 unknowns were not broken routes: the manual baseline identified 30 real entries needing better classification and five intentional inline/static handlers. This map now records those entries rather than treating the heuristic as a defect detector.

**No route extraction is approved.** Keep cross-domain/channel handlers and their called store functions together until transaction, authorization, and invariant edges are fully verified. URL prefixes alone are not a safe modularization boundary.
