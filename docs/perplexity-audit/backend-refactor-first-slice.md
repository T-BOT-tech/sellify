# Backend refactor: first slice

## Objective

Complete a low-risk, behavior-preserving first extraction from `backend/server.js` while keeping the server's existing call signatures and runtime configuration. Route-handler extraction remains separately gated on handler characterization.

## Implementation status

- Extracted CORS-aware JSON response serialization and structured error redaction into `backend/lib/http/response.js`.
- Kept `sendJSON` and `sendError` wrappers in `backend/server.js`; the server still supplies its configured CORS allowlist, so call sites and configuration ownership remain unchanged.
- Added focused response-contract coverage for allowed/disallowed JSON origins, OPTIONS preflight allow/deny behavior, wildcard development behavior, request IDs, content length, 4xx codes, and 5xx message/code redaction.
- Added the missing Payment production-certification route handler and a real HTTP regression for authentication, tenant isolation, read/manage permissions, and fail-closed certification.
- The payment-certification HTTP, shared-response, and CORS preflight regressions passed in Sellify CI run #3900 at commit `b9afc747487b999ee70e4cd19ee1c36ecc2eb15a`.
- Full Sellify CI run #3900 passed all five jobs, including the baseline, Phase 13.10.24, Phase 21 capacity evidence, Logistics L18, and Logistics exit certification jobs. Repository Security Checks #3364 and Perplexity inventory #72 also passed at that code head.
- The implementation slice is CI-verified. This does not certify overall production readiness or approve bulk route extraction.

This slice does not change API contracts, database schemas, business rules, or authorization policy.

## Verified source baseline

- The explicit `ROUTES` table contains 247 method/pattern entries.
- Those entries resolve to 137 distinct named handler functions.
- Six additional inline HTTP handlers are inventoried outside the route table.
- The path classifier still leaves 35 route entries unclassified; these require manual ownership review.
- The static route inventory now resolves all named handler references to local declarations or named imports, but does not map authorization requirements, middleware, tenant/location scope, handler side effects, or error contracts.

## Scope

Do not begin with a bulk route move. The response-helper extraction is the first bounded slice. Next complete a handler-level characterization map before considering any route-module extraction.

### Implemented in this slice

- Extract CORS-aware JSON and structured-error serialization into `backend/lib/http/response.js`.
- Preserve server-owned CORS configuration and existing `sendJSON`/`sendError` call signatures through thin wrappers.
- Pin headers, content length, CORS allow/deny behavior, request-ID propagation, 4xx code handling, and 5xx message redaction in a standalone regression.

### Next bounded task

- Complete the route-to-handler characterization map for all 247 explicit route entries and six inline handlers.
- Record each handler's authentication/session requirements, authorization resource/action, tenant and location scope, validation, idempotency, side effects, response/error contract, and targeted regression tests.
- Review all 35 currently unclassified route entries and confirm proposed ownership with the canonical domain owners.
- Do not move the request dispatcher, rate limiter, static-file allowlists, authentication, or route handlers until their behavior and boundaries are characterized.

### Out of scope

- Do not alter route paths, HTTP methods, status codes, payloads, or error formats.
- Do not change authentication, tenant, organization, location, role, or permission checks.
- Do not modify SQLite schema, SQL, transactions, or migration behavior.
- Do not extract payment, inventory, fulfillment, or scheduling logic in this slice.
- Do not rename existing npm scripts or delete existing tests.

## Proposed route grouping

| Module | Suggested routes |
|---|---|
| `auth.js` | Authentication, session, identity, and account routes |
| `procurement.js` | Demand, RFQ, comparison, award, PO, receiving, and settlement routes |
| `suppliers.js` | Supplier profile, capability, catalog, service area, qualification, and capacity routes |
| `inventory.js` | Inventory, stock, movement, ledger, and low-stock routes |
| `warehouse.js` | Warehouse, location, bin, receiving, and adjustment routes |
| `logistics.js` | Logistics, shipment, proof, return, courier, route, and scheduling routes |
| `payments.js` | Payment, provider, checkout, and settlement routes |
| `telegram.js` | Telegram storefront, buyer, checkout, order, and fulfillment routes |
| `discovery.js` | Discovery, matching, ranking, opportunity, and AI-intent routes |

The exact grouping must be validated against the actual route declarations in `backend/server.js` before implementation.

## Implementation sequence

1. Complete and manually review the route-to-handler, authorization, scope, side-effect, and response map.
2. Extract only the pure HTTP response helper, preserving public behavior and call sites. (Implemented; CI verification pending.)
3. Run focused HTTP response, CORS, request-ID, API-boundary, and adversarial tests.
4. Complete the handler-level authorization/scope/side-effect map before selecting a route group.
5. Keep route extraction separate from persistence extraction; do not split both large files in the same change.

## Acceptance criteria

- All existing routes remain available at their current paths and methods.
- Every route has a named handler reference or an explicit reviewed exception.
- Every extracted handler has a reviewed authorization, tenant/location scope, side-effect, and error-contract record.
- Existing HTTP status codes, payloads, headers, and error responses remain unchanged.
- Authentication, tenant isolation, organization scope, location scope, and authorization behavior remain unchanged.
- Existing security, API-boundary, adversarial, and regression gates pass.
- `backend/server.js` becomes materially smaller and easier to review.
- No new canonical authority is introduced.

## Rollback plan

Because this is an incremental extraction:

- Keep the original route-registration code available until the slice is verified.
- Revert the specific route-module extraction if a gate fails.
- Do not combine multiple high-risk domains in one commit.
- Do not merge without the required regression and security gates.
