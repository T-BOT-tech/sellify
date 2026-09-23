# SELLIFY — Phase 21.2 Implementation Handoff

## Phase

**21.2 — Supply Capability**

## Status

**IMPLEMENTED — PASS**

## Decision

Phase 21 reuses the existing **Supplier Network Capability** authority. No second capability store, supplier registry, inventory authority, procurement engine, or provider integration was introduced.

The new `app/src/phase21-supply-capability.js` module is a composition/projection boundary only.

## Authority Map

| Concern | Canonical authority |
|---|---|
| Supplier identity | Organizations |
| Supplier participation | Procurement / Supplier Network prerequisite |
| Supplier capability | Supplier Network |
| Product identity | Existing Product/Catalog |
| Inventory truth | Existing Inventory |
| Procurement demand / award | Existing Procurement |
| Payment | Existing Payment Core |
| Phase 21 projection | Derived / non-authoritative |

## Projection

`projectSupplyCapability()` accepts an existing Supplier Network capability and returns immutable references plus sourcing-relevant metadata.

It does not persist, mutate, authorize, transact, reserve inventory, create procurement records, or execute providers.

## Invariants

- `UNKNOWN` remains `UNKNOWN`.
- Capability is not inventory.
- Capability is not procurement demand.
- Capability is not an order.
- Supplier Network remains capability authority.
- Organization remains identity authority.
- Product/Catalog remains product identity authority.
- Phase 21 owns no capability database.
- No duplicate event store or provider integration is created.

## Verification

Phase 21.2 regression: **13 PASS / 0 FAIL**.

Existing Phase 21.0 and Phase 21.1 regressions must continue to pass before cumulative gates.

Node runtime in the source environment remains Node v22.16.0; Node >=24 verification remains deferred to the existing runtime verification phase.
