<!-- Historical snapshot: reviewed on audit/perplexity-codebase-modularity-20261122 at 479bb1f272c2be96bd4086fb7598e134dde8cb80. Current-main route map is docs/audit/route-characterization.md and route-characterization.json. -->

# Manual route characterization — Wave 0

Reviewed against `backend/server.js` on branch `audit/perplexity-codebase-modularity-20261122`, head `479bb1f272c2be96bd4086fb7598e134dde8cb80`.

## Result

The inventory's 35 `unknown` classifications are **not 35 unresolved handlers or 35 unknown business domains**.

- 30 entries are explicit `ROUTES` table declarations with resolvable local handlers.
- 5 entries are intentional inline HTTP/static-serving branches outside the `ROUTES` table.
- The generated inventory reports zero unresolved handler references and zero duplicate route keys.
- The heuristic classifier failed to recognize several real domain groups: Customer, B2B Customer Pricing, Service Booking/Service Resource, Restaurant Recipe, Fulfillment, Seller Storefront projection, and the legacy seller Orders feed.

Therefore, do not create an `unknown.js` module or extract the 35 entries as a group. Correct domain classification and handler characterization are separate tasks.

## Route groups and current behavior

| Domain group | Routes | Observed boundary / behavior | Existing evidence and remaining review |
|---|---:|---|---|
| Customers | 4 | Tenant lookup and tenant session are required. List/get use `customers:view`; create/patch use `customers:manage`. Data operations are tenant-keyed through the existing customer store functions. | Verify request validation, duplicate/upsert semantics, and customer update not-found behavior in store implementation. No extraction recommendation yet. |
| B2B customer pricing | 4 | Tenant session plus `b2b:pricing:view` for reads and `b2b:pricing:manage` for writes. Reads support customer/product/status/limit filters; writes use existing list/get/upsert/update store functions. | Existing `phase0/fux-56-b2b-customer-pricing-frontend-authority-regression.mjs` checks canonical frontend/API/store authority. Review input validation and idempotency expectations before any move. |
| Business template | 3 | Tenant session required. GET permits authenticated tenant members; PUT/PATCH require owner role. Persistence uses `getBusinessTemplateConfig` / `saveBusinessTemplateConfig`. | Existing first-experience service-catalog frontend-sync regression checks owner-only writes and fixed template-key allowlist/audit behavior. |
| Service Booking | 3 | Tenant session; resolves the canonical order from the tenant's order list; resolves its canonical location; reads require `service:service_booking:view`. Mutations require an idempotency key and use the existing service-booking lifecycle store functions with contextual authorization. | Existing service-booking lifecycle, persistence, scheduling-authority, service-provider queue, and GAP-2 compatibility regressions cover important behavior. High coupling to order/location/resource authorization; do not extract as a route-only slice. |
| Service delivery assessment | 1 | Tenant session; requires an idempotency key; delegates the command to `recordServiceDeliveryAssessment`. The handler deliberately lets the store authority check durable replay before revalidating mutable order/location/role state inside the transaction. | Preserve the store's atomic replay/authorization ordering. Existing service-delivery and logistics boundary regressions are relevant. Do not move this logic into a route module. |
| Service Resources and availability | 5 | Tenant session; resource reads/writes use the existing resource store. Resource authorization is evaluated with organization/location/resource context. Service Provider contextual roles are restricted to explicitly assigned active resources; availability reads/writes have separate view/manage actions. | Existing resource foundation, SQLite persistence, resource-scoped authorization, location scope, and SC-03.5 queue/availability regressions. High authorization coupling; not a first extraction candidate. |
| Service Provider views | 2 | Tenant session; requires an active RESOURCE-scoped `service_provider` contextual role, filters resources to assigned IDs, checks resource/location authorization, then reads provider resources/bookings. | Existing SC-03.3 provider resource-scoped authorization and SC-03.5 provider queue regression. Preserve the contextual-role and location checks as a unit. |
| Fulfillment | 2 | Tenant session. GET uses `fulfillment:view`. POST distinguishes courier from non-courier: courier path requires `logistics:deliveries:update_assigned` and `assertCourierOwnsDelivery`; other actors require `fulfillment:update`. POST requires an idempotency key and delegates the transition to the existing fulfillment store authority. | Existing FUX-42/FUX-44 and GAP-2 delivery regressions. Frozen logistics boundary; do not fold fulfillment into a new logistics authority or extract it without a dedicated compatibility plan. |
| Restaurant Recipes | 3 | Tenant session; GET requires `restaurant:recipes:view`; POST/PATCH require `restaurant:recipes:manage`. Reads and writes call existing recipe store functions and return `authority: 'restaurant_recipe'`. | Existing `phase0/restaurant-recipe-persistence-regression.mjs` covers tenant isolation and server authorization; keep the canonical recipe authority. |
| Seller storefront projections | 2 | Session and tenant authorization use `seller_storefront_channels` / `settings:configure`; handlers expose storefront-channel and cross-channel consistency projections. | Existing FUX-55 seller storefront channel authority and cross-channel consistency contract tests. These are projections, not a new transaction or inventory authority. |
| Seller Orders feed | 1 | Tenant session and `orders:view`; clamps requested limit to 1–200 and reads the tenant's existing order list. | Confirm compatibility with existing sync/order pull semantics before considering movement. |
| Inline operational/static routes | 5 | `/health` returns process health; `/backend/lib/*` and `/shared/*` serve only their respective browser-module allowlists; `/store/:id` serves the public storefront HTML; `/track` serves tracking HTML. These are server dispatch branches, not business-domain handlers. | Existing browser-module allowlist, browser-module HTTP, and production-server regressions. Keep static serving separate from business route modules. |

## Extraction decision

**No route extraction is approved by this characterization pass.**

The most cohesive groups are not necessarily the safest to move: Service Booking, Service Resources, Fulfillment, and Seller Storefront are deeply connected to canonical store operations, tenant/location scope, contextual roles, idempotency, or existing frozen boundaries. Customer and pricing handlers look smaller, but still need store-level validation and HTTP behavior characterization before a move.

A safe next slice should be selected only after:
1. Mapping the complete handler body and its direct store/authorization dependencies.
2. Identifying request validation, tenant/resource/location scope, idempotency, and side effects.
3. Finding the existing behavioral regressions and adding a real HTTP characterization test where coverage is only source-level.
4. Demonstrating that the extraction preserves the exact route contract and server-owned dependencies.

## Source-of-truth limitations

This is a manual characterization of the current route dispatch and the inspected handler portions. It is not a complete dynamic call-graph audit, does not prove all store invariants, and is not a production-readiness certification. Generated route classifications remain review aids, not ownership authority.


## Current-main supersession note (2026-11-23)

The route inventory has been refreshed against `main` at `e216db18ade2a5ffa66aff9dc3096e207251a918`. The current map includes per-route auth and permission evidence, direct/delegated store dependencies, error/idempotency signals, and the confirmed payment routing policy permission gap. This historical manual review remains intact; use `docs/audit/route-characterization.md` for current route state.
