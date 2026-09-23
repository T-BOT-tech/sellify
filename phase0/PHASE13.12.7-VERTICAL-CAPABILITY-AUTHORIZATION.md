# Phase 13.12.7 — Vertical Capability Authorization

## Purpose

Establish the enforceable security boundary for Phase 13 vertical capabilities.
Every Agriculture, Restaurant, Warehouse, and Logistics capability must resolve
through the Phase 13.12.3 resource/action registry and then delegate its final
policy decision to the existing Phase 10.3 `authorize()` authority.

## Security chain

```text
Actor / Session
      ↓
Canonical Tenant + Location Isolation
      ↓
Phase 13 Resource / Action Registry
      ↓
Policy-defined?
      ├── NO → DENY
      └── YES
             ↓
      Phase 10.3 authorize()
             ↓
      ALLOW / DENY / REQUIRES_APPROVAL
```

## Important invariant

The registry's `permission: null` entries are vocabulary only. They must not
become implicitly authorized through the Phase 10.3 owner `*` wildcard. A
central permission must be deliberately introduced before such a capability
can be authorized.

## Implementation

`backend/lib/vertical-capability-authorization.js` is an enforcement adapter.
It introduces no role store, permission store, persistence, membership model,
or authorization evaluator. It delegates the final policy decision to
`backend/lib/authorization.js` and reuses `backend/lib/tenant-isolation.js`.

## Scope

Covered:

- Agriculture: farm, plot, season, crop, harvest, commodity, collection center, buyer
- Restaurant: table, kitchen, recipe, preparation
- Warehouse: storage, receiving, stock adjustment
- Logistics: shipment, route, delivery, proof, return, courier
- organization isolation
- location isolation
- policy-defined vs vocabulary-only enforcement
- owner wildcard preservation only where a central permission is defined

Not pulled forward:

- mutation enforcement (13.12.8)
- approval boundary (13.12.9)
- sensitive audit enforcement (13.12.10)
- API attack testing (13.12.11)
- event/outbox integration (13.14)
- pack configuration (13.13)

## Exit invariant

No Phase 13 vertical capability may claim authorization independently of the
canonical Phase 10.3 policy authority.
