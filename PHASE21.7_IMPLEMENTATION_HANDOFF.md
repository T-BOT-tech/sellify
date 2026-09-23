# SELLIFY Phase 21.7 — Supply Gap / Alternative Sourcing

Status: IMPLEMENTED / PASS

## Purpose

Phase 21.7 derives uncovered sourcing requirements from existing Phase 21 demand requirements and sourcing opportunities. It also exposes additional eligible opportunities as alternative sourcing candidates.

This is a projection only. It does not create a second inventory, procurement, supplier, capacity, order, payment, logistics, event, ledger, or provider authority.

## Authority map

- Demand: existing Procurement authority
- Commodity: Agriculture authority
- Supplier / Capability / Capacity: existing Supplier Network authority
- Inventory: existing Inventory authority
- Acquisition: existing Procurement / Commerce authorities
- Payment: existing Payment authority
- Provider execution: existing controlled adapters / owning domains

## Semantics

`COVERED` means confirmed eligible opportunities with known positive quantities in the demand unit meet the requirement.

`PARTIAL_GAP` means confirmed eligible quantity is known but is below demand.

`FULL_GAP` means no confirmed eligible quantity is available and no unknown candidate prevents a definitive gap conclusion.

`UNKNOWN` is used when unresolved/unknown candidate information prevents a safe conclusion. Unknown is never treated as successful supply.

Alternative sourcing is a derived list of additional eligible opportunities. It does not select, award, reserve, order, pay, or execute any supplier.

## Non-authority invariants

- Supply gap is not an Inventory fact.
- Supply gap is not an Inventory reservation.
- Alternative sourcing is not Procurement Award.
- Alternative sourcing is not a Purchase Order.
- Opportunity eligibility is not authorization.
- Authorization is not execution.
- External providers remain behind controlled adapters.
- Persistence is none.
- Mutation is false.

## Verification

Phase 21.7 regression: 17 PASS / 0 FAIL.

Cumulative Phase 21 tests through 21.7: 130 PASS / 0 FAIL.

Node >=24 remains deferred to the established verification phase; the current environment is Node 22.16.0.
