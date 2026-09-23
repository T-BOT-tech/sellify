# SELLIFY P1-IMPLEMENTATION-12 — Pack Capability → Journey Composition

Date: 2026-09-19

## Scope

P1-12 connects the current declarative Pack manifests to existing executable journey surfaces. It is a composition/traceability layer only.

### Current mappings

- Agriculture: declarative-only foundation; no executable Pack UI entry point is claimed.
- Restaurant: `table-management` → Restaurant floor (`tables`); `kitchen-management` → Kitchen operations (`kitchen`); `restaurant-order-context` → Restaurant floor.
- Warehouse: all declared warehouse capabilities compose into Warehouse operations (`warehouse`).
- Logistics: all declared logistics capabilities compose into Fulfillment & delivery (`logistics`).

## Boundaries

- Pack manifests remain the capability/entry-point source.
- Existing configuration remains the Pack configuration authority.
- Existing tab/workspace modules remain the executable journey surfaces.
- Navigation visibility does not grant authorization.
- No transaction, business-domain, persistence, approval, or IAM authority is introduced.
- Server authorization remains authoritative.
- A capability with no executable Pack entry remains explicitly non-executable rather than being presented as implemented UI.

## Validation

- `node phase0/p1-12-pack-capability-journey-composition-regression.mjs` — PASS
- `node --check app/src/experience/pack-journey-composition.js` — PASS
- `node --check app/src/experience/pack-workspace.js` — PASS
- `node phase0/fux29-seller-golden-journey-regression.mjs` — PASS
- `node phase0/fux30-multi-channel-adversarial-regression.mjs` — PASS

Node module-type warnings are non-failing. Release certification still requires the project's Node >=24 runtime gate.
