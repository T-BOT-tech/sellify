# Backend route characterization — initial evidence map

**Baseline:** `main` at `07985fcc841e3f16fd5b6f4f46f1bb5101443085`  
**Audit branch:** `audit/route-sqlite-characterization-20261123`  
**Source:** `backend/server.js`  
**Status:** inventory complete at the static declaration level; handler behavior characterization remains in progress.

## Verified source inventory

| Measure | Current source result |
|---|---:|
| Explicit `ROUTES` table entries | 247 |
| Selected inline dispatch entries | 6 |
| Total inventory entries | 253 |
| Distinct named handler functions | 137 |
| Unresolved named handler references | 0 |
| `server.js` source size | 274,442 bytes |

The route table was parsed from the actual current source. All named handler references resolved to a local declaration or named import under the same static resolution rule used by the existing scanner. This does not establish runtime execution or behavior.

## Important correction to the older Wave 0 note

The existing inventory scanner declares **six** selected inline patterns: `/health`, `/config.js`, `/backend/lib/*`, `/shared/*`, `/store/:param`, and `/track`. The old manual Wave 0 table listed five because `/config.js` was not included in its “unknown” group; it is heuristically classified by the old path classifier. Therefore “five inline routes among the 35 unknown classifications” and “six inline routes in the total inventory” can both be true. Keep this distinction explicit.

The previous Wave 0 document cites audit-branch head `479bb1f272c2be96bd4086fb7598e134dde8cb80`; it is historical evidence, not the current baseline. This pass re-parsed current `main`.

## Characterization state

The JSON companion contains one record per detected route, with explicit pending markers for:

- authentication and authorization;
- tenant, organization, location, and resource scope;
- request validation and error/status behavior;
- idempotency and transaction boundaries;
- store calls and side effects;
- regression coverage.

Those fields are deliberately **not guessed** from URL paths or handler names. A route is not considered characterized until its actual handler, helper calls, store calls, and relevant tests have been inspected.

## Current conclusions

1. The existing scanner provides a reliable starting inventory for the central route table, not a complete HTTP behavior map.
2. The old path classifier is only a review hint; unknown classifications must be manually assigned by handler behavior and canonical authority.
3. No route extraction is approved by this pass.
4. Service Booking, Service Resources, Fulfillment, Customer writes, and payment/provider notification paths must be assessed with their existing authorization, idempotency, replay, and transaction boundaries intact.
5. Static-serving branches should remain infrastructure concerns, not be assigned to business-domain route modules.

## Next characterization batch

Proceed in bounded handler groups. For each route, record the exact handler source range, authorization helper and permission, scope inputs, validation and status mapping, direct store calls, transaction/replay behavior, emitted events or audit records, and exact regression test paths. Prioritize high-risk authorization and mutation paths before proposing any extraction.

## Limitations

This is an evidence-backed route inventory and characterization scaffold, **not yet the complete handler-level map requested by the audit**. The machine-readable file marks all unverified fields as pending. Do not treat missing characterization as permission to refactor.


## Characterization batch 1 — Customer and B2B Pricing

**Status:** 8 route/method entries characterized from current source.

| Route family | Methods | Authentication / authorization | Persistence and behavior |
|---|---|---|---|
| `/tenants/:tenantId/customers` | GET, POST | Tenant session; `customers:view` or `customers:manage` | Organization-scoped customer list and canonical natural-key upsert |
| `/tenants/:tenantId/customers/:customerId` | GET, PATCH | Tenant session; `customers:view` or `customers:manage` | Organization-scoped read/update; PATCH merges aliases and delegates to canonical upsert |
| `/tenants/:tenantId/b2b/pricing` | GET, POST | Tenant session; `b2b:pricing:view` or `b2b:pricing:manage` | Organization-scoped price rules; validates business customer, tenant product and matching currency |
| `/tenants/:tenantId/b2b/pricing/:pricingId` | GET, PATCH | Tenant session; `b2b:pricing:view` or `b2b:pricing:manage` | Organization-scoped price rule read/update |

### Customer persistence observations

- `listCustomers` filters by `organization_id` and clamps limit to 1–200.
- `getCustomer` filters by both customer ID and organization ID.
- `upsertCustomerSync` validates optional default location against the same organization and appends `customer.created` / `customer.updated` audit events.
- Customer writes do not show an explicit transaction wrapping the data write and audit append in the inspected call path.
- The HTTP regression covers unauthenticated and cross-tenant access, role permission differences, ID collision, malformed/null bodies, natural-key reuse, sparse updates, audit provenance, and sync-event replay.

### B2B Pricing persistence observations

- `customer_pricing_rules` has organization/customer foreign keys and a unique constraint on `(organization_id, customer_id, product_id)`.
- Store writes require a business customer in the same organization, a product belonging to the tenant/organization, a non-negative integer minor-unit price, and product-currency equality.
- `upsertCustomerPricing` appends `b2b.custom-pricing.upserted` audit data after its SQL upsert.
- Existing tests cover first creation, list, currency mismatch, retail-customer rejection, and frontend/API/store authority; they do not cover repeated POST to the same unique tuple.

### Defect candidate — repeated B2B pricing save

The current UI's `saveCustomerPricing()` sends POST without an `id`. The store generates a new ID before executing `INSERT ... ON CONFLICT(organization_id, customer_id, product_id) DO UPDATE`. On conflict, the existing row ID remains unchanged, but the function then calls `getCustomerPricing(chatId, id)` with the newly generated ID. That lookup can return `null` although the existing row was updated.

**Disposition:** high-confidence source-level defect candidate; add a repeated-save regression and confirm through CI before changing production code. Not fixed in this audit branch.



## Characterization batch 2 — Service Resources, Service Booking, Service Delivery Assessment and Fulfillment

**Status:** 13 route/method entries characterized from current handler source.

| Route family | Methods | Authorization and scope | Key behavior |
|---|---|---|---|
| `/tenants/:tenantId/service-provider/resources` | GET | Active RESOURCE-scoped `service_provider` role; per-resource view authorization | Returns only assigned active resources and their availability |
| `/tenants/:tenantId/service-provider/bookings` | GET | Active RESOURCE-scoped `service_provider` role; per-resource booking-view authorization | Returns bookings for assigned active resources only |
| `/tenants/:tenantId/service-resources` | GET, POST | `service:service_resource:view/manage`; organization/location/resource context | Provider reads are assignment-limited; writes use canonical resource registry. POST/PATCH require a body idempotency key; PATCH also requires expected version |
| `/tenants/:tenantId/service-resources/:resourceId` | PATCH | `service:service_resource:manage`; validates both existing and destination location scope | Prevents location-scoped manager from moving a resource using only target-location authorization |
| `/tenants/:tenantId/service-resources/:resourceId/availability` | GET, PUT | `service:resource_availability:view/manage`; resource/location context | PUT requires an idempotency key and returns replay state |
| `/tenants/:tenantId/orders/:orderId/service-bookings` | GET, POST | Canonical order/location; view or request permission | POST requires idempotency; replay returns 200, new booking 201 |
| `/tenants/:tenantId/orders/:orderId/service-bookings/:bookingId` | PATCH | Canonical order/location; confirm/cancel/manage permission selected by target state | Idempotent lifecycle transition |
| `/tenants/:tenantId/orders/:orderId/service-delivery-assessment` | POST | Store command authority owns current authorization | Durable replay is checked before mutable order/location/role state |
| `/tenants/:tenantId/orders/:orderId/fulfillment` | GET, POST | Fulfillment view/update or courier assigned-delivery permission plus ownership check | POST is idempotent and delegates lifecycle/inventory consequences to canonical fulfillment store |

### Boundary findings

- Service Provider access is not a tenant-wide role shortcut. It is limited to active, explicitly assigned resource IDs and checks each resource's location and authorization context.
- Service Booking is coupled to the canonical order and its location. Its lifecycle command uses idempotency and delegates persistence/commitment behavior to the existing store authority.
- Service Delivery Assessment intentionally checks durable replay before revalidating mutable authorization context. Moving authorization ahead of replay would change the command contract and could break safe retries after role/location changes.
- Fulfillment is not interchangeable with Logistics. The handler has distinct courier and non-courier permission paths; the store owns fulfillment transitions and inventory consequences.
- These routes are not safe candidates for a route-only extraction until the existing authorization, resource scope, replay, and transactional contracts are preserved.

### Regression evidence

The source-referenced regression set includes service resource foundation/persistence/provider-scope/availability tests; service booking contract/persistence/scheduling-authority/provider-queue tests; service delivery and GAP-2 adversarial tests; and FUX-42, Phase 12.2, and GAP-2 fulfillment/delivery tests. Exact paths are listed per route record in the JSON companion.

**Disposition:** no route extraction approved. Preserve the existing Service, Fulfillment and Logistics authority boundaries.


### Additional Service Resource command detail

The `handleServiceResources` handler does not copy an `Idempotency-Key` HTTP header into the body. The underlying `createServiceResource` and `updateServiceResource` store functions require `idempotencyKey` or `idempotency_key` in the parsed body; PATCH additionally requires an expected version. Their command tables, version checks, and active-commitment checks are part of the canonical resource mutation boundary. Clients relying only on the header will receive a missing-key error.

This is a contract detail to preserve and verify against the frontend callers before any route movement.


## Characterization batch 3 — Business Template and Restaurant Recipes

**Status:** 6 additional route/method entries characterized.

| Route family | Methods | Authorization | Persistence boundary |
|---|---|---|---|
| `/tenants/:tenantId/business-template` | GET, PUT, PATCH | Any tenant session for read; owner role for writes | Canonical tenant template key/config only; strict schema-v1 allowlist; write and audit evidence are atomic |
| `/tenants/:tenantId/restaurant/recipes` | GET, POST | `restaurant:recipes:view/manage` | Organization-scoped canonical recipe records; POST uses stable client ID and content fingerprint |
| `/tenants/:tenantId/restaurant/recipes/:recipeId` | PATCH | `restaurant:recipes:manage` | Version-checked update with `expectedVersion`; mutation and audit are transactional |

### Boundary findings

- Business Template is tenant configuration, not a new business-template authority: writes are owner-only, schema version is fixed at 1, fields are allowlisted, and custom config is currently unsupported.
- Restaurant Recipes are a canonical restaurant capability. POST retries with the same ID and same normalized content are duplicate-safe; reuse with different content conflicts. PATCH uses optimistic version control and requires a valid expected version.
- Both store paths write audit evidence inside their SQLite transaction. Preserve those boundaries and the current allowlists during any future route movement.

**Disposition:** no extraction approved.


## Characterization batch 4 — Seller Storefront projections

**Status:** 2 additional GET routes characterized.

- `GET /tenants/:tenantId/storefront-channels` and `GET /tenants/:tenantId/storefront-consistency` require a tenant session and `settings:configure` authorization.
- Both read the existing Telegram storefront configuration and build channel projections; the consistency route also evaluates the shared cross-channel contract.
- These handlers are read-only projections. They do not create a second seller, order, inventory, payment, or fulfillment authority.

Regression evidence: `phase0/fux-55-seller-storefront-channel-authority-regression.mjs`, `phase0/fux26-storefront-channel-contract-regression.mjs`, `phase0/fux27-unified-seller-storefront-regression.mjs`, and `phase0/fux28-cross-channel-consistency-regression.mjs`.

**Disposition:** preserve projection-only behavior; no extraction approved.
