# Phase 13.12.1 — Authorization Authority Inventory

**Status:** COMPLETE — 2026-09-08  
**Scope:** Inventory and certify the existing Phase 10.3 authorization authority; no second authorization implementation.

## Objective

Inventory every authorization authority and enforcement path relevant to the Phase 13 vertical architecture.

The canonical authority remains:

```text
authorize(actor, organization, location, resource, action)
→ ALLOW | DENY | REQUIRES_APPROVAL
```

This phase does not create a new permission registry, role store, policy evaluator, vertical authorization module, or authorization database.

## Actual source inspected

The current Phase 13.11.21 source was inspected before this record was created, including:

- `backend/lib/authorization.js`
- `backend/lib/tenant-isolation.js`
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- `app/src/auth/tenant.js`
- `app/src/audit/audit-boundary.js`
- `app/src/verticals/agriculture/pack.js`
- `app/src/verticals/agriculture/*.js` contracts/bridges
- `app/src/verticals/restaurant/pack.js`
- `app/src/verticals/restaurant/*.js` contracts/bridges
- `app/src/verticals/warehouse/pack.js`
- `app/src/verticals/warehouse/authority-map.js`
- `app/src/verticals/warehouse/*.js` contracts/bridges
- `app/src/verticals/logistics/pack.js`
- `app/src/verticals/logistics/authority-map.js`
- `app/src/verticals/logistics/*.js` contracts/bridges
- Phase 13.11 authorization/tenant-isolation and audit controls
- Phase 10.3 central authorization control artifacts

## Authority inventory

| Concern | Current authority | Phase 13 vertical status | 13.12 decision |
|---|---|---|---|
| Actor/session identity | existing session + membership/device model | consumed | preserve |
| Organization scope | canonical organization mapping + tenant isolation | consumed | preserve |
| Location scope | canonical location model + authorization inputs | consumed | preserve |
| Role policy | `backend/lib/authorization.js` | consumed | preserve |
| Permission policy | `ROLE_PERMISSIONS` in `backend/lib/authorization.js` | consumed | preserve |
| Authorization evaluation | `authorize()` | consumed | preserve |
| Server enforcement | `requireAuthorization()` in `backend/server.js` | consumed by existing protected APIs | strengthen coverage in later 13.12 gates |
| Audit evidence | existing audit authority / `audit_events` | consumed | preserve |
| Agriculture authorization | no executable vertical evaluator; pack declares capability metadata | contract/bridge layer | map executable actions to Core authority before mutation |
| Restaurant authorization | no executable vertical evaluator; pack declares capability metadata | contract/bridge layer | map executable actions to Core authority before mutation |
| Warehouse authorization | no executable vertical evaluator; pack declares capability metadata | contract/bridge layer | map executable actions to Core authority before mutation |
| Logistics authorization | none of its own | contract/bridge layer | must use Core authority when executable |
| Vertical role store | none | no duplicate authority | forbidden |
| Vertical permission registry | pack-level declarative `permissions` metadata exists; no evaluator/store | metadata only | must not become a second authority |
| Vertical tenant/session system | none | no duplicate authority | forbidden |
| Vertical audit authority | none | Core audit remains canonical | forbidden |

## Current server-enforced permission surface

The inspected server currently routes authorization through the canonical helper for existing protected capabilities including:

- Orders
- Customers
- B2B pricing
- B2B quotes
- B2B purchase orders
- B2B credit terms
- Inventory
- Locations
- Payments
- B2B receivables
- B2B invoices
- Audit
- Compliance
- Marketplace order updates/cancellation

The precise resource/action strings remain those already defined by Phase 10.3. This phase does not rename or broaden them.

## Vertical capability inventory

### Agriculture

Phase 13 Agriculture owns domain vocabulary and workflows such as identity, farm/plot/season, inventory bridges, buyer/commerce and procurement bridges.

Current Phase 13 implementation is contract/bridge-oriented. The Agriculture pack declares `agriculture:manage` / `agriculture:view` as pack metadata, but no Agriculture policy evaluator or persistence exists. These declarations are not authorization until mapped to the canonical Core authority.

When an Agriculture capability becomes an executable mutation, authorization must resolve through the canonical Core authorization boundary before the mutation is performed.

### Restaurant

Restaurant owns table, kitchen, recipe and preparation semantics and composes Commerce/Inventory/Warehouse/Logistics authorities.

The Restaurant pack declares existing table/kitchen action names as pack metadata, but no Restaurant policy evaluator or persistence exists. The declarations are not a second authorization authority.

Executable Restaurant mutations must use the canonical authorization boundary rather than creating a Restaurant policy engine.

### Warehouse

Warehouse owns StorageBin, Receiving and StockAdjustment semantics while Inventory remains authoritative for stock and movement.

The Warehouse pack declares `inventory:add` / `inventory:edit` as pack metadata, but no Warehouse policy evaluator or persistence exists. The canonical Core authorization policy remains authoritative.

Warehouse mutations must be authorized before invoking canonical Inventory/Warehouse authority paths.

### Logistics

Logistics owns Courier, Route, Shipment, Delivery, Proof and Return semantics while Core Commerce, Inventory, Locations, Fulfillment and Audit remain authoritative where declared.

Route execution remains deferred and therefore has no route-specific authorization surface.

No Logistics-specific role or permission authority exists in the inspected Phase 13 source.

## Security conclusion

The authorization architecture is currently **single-authority**:

```text
Actor / Session
      ↓
Organization + Location scope
      ↓
Phase 10.3 authorize()
      ↓
ALLOW / DENY / REQUIRES_APPROVAL
      ↓
Canonical capability / vertical contract
      ↓
Canonical authority
      ↓
Audit / later event boundary
```

The main Phase 13.12 work remaining is therefore **enforcement coverage and adversarial proof**, not authorization-framework creation.

## Deliberately not changed

- `backend/lib/authorization.js` — already canonical.
- `backend/lib/store-sqlite.js` identity/session persistence — already authoritative.
- `backend/server.js` authorization architecture — existing server-side enforcement is preserved.
- Vertical pack `permissions` declarations — existing declarations are preserved as metadata only; they are not promoted into a second permission registry or evaluator.
- No database migration.
- No new role table.
- No new permission table.
- No vertical authorization service.
- No event/outbox implementation — reserved for Phase 13.14.
- No pack configuration implementation — reserved for Phase 13.13.

## Exit criterion

Phase 13.12.1 passes when the repository can demonstrate that there is one authorization authority, existing protected APIs use it, vertical packs do not introduce competing authorization authorities, and later 13.12 enforcement tests have a concrete inventory against which to validate coverage.
