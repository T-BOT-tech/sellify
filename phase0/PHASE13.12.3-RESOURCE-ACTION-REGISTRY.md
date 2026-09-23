# Phase 13.12.3 — Resource / Action Registry

**Status:** COMPLETE — 2026-09-08  
**Scope:** Establish a canonical declarative resource/action vocabulary for Phase 13 vertical capabilities without creating a second authorization evaluator or permission store.

## Objective

Create a stable registry that maps Phase 13 vertical capability resources and actions to the existing Phase 10.3 authorization permission keys where such policy already exists.

The registry is **not** an authorization engine. The canonical authority remains:

```text
authorize(actor, organization, location, resource, action)
→ ALLOW | DENY | REQUIRES_APPROVAL
```

## Actual source basis

The implementation was inspected before this phase, including:

- `backend/lib/authorization.js`
- `backend/lib/security-context.js`
- `backend/server.js`
- `backend/lib/tenant-isolation.js`
- `app/src/audit/audit-boundary.js`
- Agriculture, Restaurant, Warehouse and Logistics pack boundaries/contracts
- Phase 13.12.1 authorization authority inventory
- Phase 13.12.2 security context contract

## Registry model

Each registry entry contains:

- `packId`
- `resource`
- `action`
- `permission`
- canonical `authorizationAuthority`
- `policyDefined`

The registry contains **42** entries across the four Phase 13 vertical packs.

### Agriculture

Farm, Plot, Season, Crop, Harvest, Commodity, Collection Center and Buyer are registered with `view` / `manage` actions mapped to the existing pack-level metadata keys:

```text
agriculture:view
agriculture:manage
```

These keys remain declarative metadata until the canonical Phase 10.3 role matrix deliberately grants them. This phase does not broaden the central role policy.

### Restaurant

Table and Kitchen actions map to existing central keys:

```text
tables:status
tables:manage
kitchen:manage
```

Recipe and Preparation are registered as vocabulary-only because no corresponding central permission currently exists.

### Warehouse

Storage, Receiving and Stock Adjustment actions map to existing central inventory permissions:

```text
inventory:view
inventory:add
inventory:edit
```

Inventory remains the canonical stock/movement authority.

### Logistics

Shipment, Route, Delivery, Proof, Return and Courier actions are registered as vocabulary-only because the inspected Phase 10.3 policy contains no Logistics-specific permission surface.

No new Logistics permissions are invented in this phase.

## Security rule

A registry entry does **not** imply authorization.

```text
Security Context
      ↓
Resource / Action Registry
      ↓
Existing Phase 10.3 authorize()
      ↓
ALLOW / DENY / REQUIRES_APPROVAL
      ↓
Canonical capability
      ↓
Canonical authority
```

For vocabulary-only entries, later enforcement must remain denied unless a deliberate central authorization-policy change is introduced.

## Deliberately not changed

- `backend/lib/authorization.js`
- `ROLE_PERMISSIONS`
- session / membership / device identity
- organization/location authority
- tenant isolation
- audit persistence
- vertical pack permission metadata
- Phase 13.13 configuration
- Phase 13.14 events/outbox
- route/dispatch implementation

No database migration, permission table, role store, evaluator, or vertical authorization service was introduced.

## Exit criteria

Phase 13.12.3 passes when:

1. all four vertical packs have explicit resource/action vocabulary;
2. existing central permission keys are preserved rather than renamed;
3. vocabulary-only actions are explicitly identifiable;
4. the registry is persistence-neutral and policy-neutral;
5. the existing Phase 10.3 authorization authority remains the only evaluator;
6. Phase 13.12.2 and Phase 0 golden regressions remain green.

## Result

**Phase 13.12.3: PASS**

Next controlled subphase:

**Phase 13.12.4 — Cross-Pack Role Matrix**
