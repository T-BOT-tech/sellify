# Backend refactor: first slice

## Objective

Establish a low-risk, behavior-preserving first extraction candidate from `backend/server.js`. This document is a gated proposal, not authorization to move route handlers before their contracts are characterized.

This slice does not change API contracts, database schemas, business rules, or authorization behavior.

## Verified source baseline

- The explicit `ROUTES` table contains 247 method/pattern entries.
- Those entries resolve to 137 distinct named handler functions.
- Six additional inline HTTP handlers are inventoried outside the route table.
- The path classifier still leaves 35 route entries unclassified; these require manual ownership review.
- The static route inventory now resolves all named handler references to local declarations or named imports, but does not map authorization requirements, middleware, tenant/location scope, handler side effects, or error contracts.

## Scope

Do not begin with a bulk route move. First complete a handler-level characterization map. Only after that review may a narrowly bounded HTTP helper be extracted. Route modules are a later stage, not part of the initial extraction.

### In scope — preparation only

- Complete a route-to-handler map for all 247 explicit route entries and six inline handlers.
- Record each handler's authentication/session requirements, authorization resource/action, tenant and location scope, validation, idempotency, side effects, response/error contract, and targeted regression tests.
- Review all 35 currently unclassified route entries and confirm proposed ownership with the canonical domain owners.
- Identify whether a pure response helper (for example, JSON/error serialization) can be extracted without changing CORS, request-ID, status, header, or error-code behavior.
- Add or identify characterization tests before selecting an extraction candidate.

### First extraction candidate — not yet approved

A pure HTTP response helper is a candidate only if existing tests can pin its exact headers, CORS behavior, request-ID propagation, 4xx code handling, and 5xx message redaction. Do not move the request dispatcher, rate limiter, static-file allowlists, authentication, or route handlers as part of this first slice.

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
2. Add characterization coverage for the chosen pure HTTP helper.
3. Extract only that helper, preserving its public behavior and call sites.
4. Run focused HTTP response, CORS, request-ID, API-boundary, and adversarial tests.
5. Only in a separate follow-up, consider moving one route group after its handler dependencies and authorization boundaries are mapped.
6. Keep route extraction separate from persistence extraction; do not split both large files in the same change.

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
