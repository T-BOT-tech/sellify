# SELLIFY Phase 22.2 — Procurement Intent Contract

## Status
IMPLEMENTED

## Purpose
Phase 22.2 introduces the first concrete Phase 22 production contract: a strict,
request-scoped `ProcurementIntent` representation for AI-translated procurement
requests.

The contract translates structured AI output into a validated procurement-intent
vocabulary without creating procurement transaction state or execution authority.

## Source-of-truth rule
Phase 22 does not own procurement truth. Existing authorities remain authoritative
for Procurement Demand, RFQ, Supplier Response, Comparison, Award, Purchase Order,
Commerce Order, Payment, Inventory, Fulfillment, Logistics, Audit, and Events.

## Allowed role
Phase 22.2 may represent:
- procurement mode and user requirements;
- commodity/product references;
- quantity and unit;
- origin/destination context;
- required date;
- qualification, logistics, and commercial requirements;
- user-stated preferred supplier references;
- notes, confidence, and provenance.

## Explicitly prohibited
The intent cannot contain:
- database/query/SQL/persistence instructions;
- credentials, secrets, or tokens;
- authorization grants;
- transaction or ledger handles;
- direct execution/provider commands;
- supplier ranking or selection decisions;
- feasibility decisions;
- compliance decisions;
- RFQ/Award/PO/Order identifiers as execution instructions;
- payment execution/authorization instructions.

## Boundary
`Natural Language → AI → Structured Procurement Intent → Existing Capability → Existing Authority`

`ProcurementIntent ≠ Procurement Demand ≠ RFQ ≠ Award ≠ Purchase Order`

`INTENT ≠ FEASIBILITY ≠ AUTHORIZATION ≠ EXECUTION`

## Persistence
`none`

The contract returns an immutable, request-scoped representation. It does not
persist state and does not mutate any owning domain.

## Validation
`phase0/phase22.2-procurement-intent-regression.mjs` verifies normalization,
strict field rejection, reference authority validation, date/quantity validation,
immutability, and no-execution/no-persistence invariants.

## Runtime note
Node >=24 certification remains a later gate. The current environment is Node
v22.16.0; this phase does not claim Node >=24 certification.
