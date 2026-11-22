# Backend refactor: first slice

## Objective

Perform a low-risk, behavior-preserving extraction from `backend/server.js`.

This slice does not change API contracts, database schemas, business rules, or authorization behavior.

## Scope

Extract only shared HTTP infrastructure and route-registration structure.

### In scope

- Create `backend/lib/http/app.js` for application construction and shared middleware.
- Create `backend/lib/http/errors.js` for consistent error mapping.
- Create `backend/lib/http/request-context.js` only if request context construction is already centralized and safely extractable.
- Create domain route modules under `backend/lib/routes/`.
- Replace inline route registration with imports and mount calls.

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

1. Create a route inventory: method, path, handler, middleware, authorization requirement, and side effects.
2. Identify shared middleware and error-handling behavior.
3. Create `backend/lib/http/app.js` without changing route behavior.
4. Move one low-risk route group at a time into `backend/lib/routes/`.
5. Run the relevant API, authorization, tenant-isolation, and adversarial gates after each move.
6. Repeat until `server.js` contains only composition, startup, shutdown, and route mounting.

## Acceptance criteria

- All existing routes remain available at their current paths.
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
