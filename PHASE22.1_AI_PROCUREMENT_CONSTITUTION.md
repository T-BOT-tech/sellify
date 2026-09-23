# SELLIFY Phase 22.1 — AI Procurement Constitution

## Status

**LOCKED — 2026-09-15**

## PURPOSE

Freeze the constitutional boundary for Phase 22 — AI Procurement before any
Procurement Intent contract or procurement preparation behavior is introduced.

Phase 22 is an intelligence and orchestration layer over existing deterministic
Procurement, Supplier Network, Discovery, Supply Intelligence, Cross-Border,
Commerce, Inventory, Payment, Fulfillment, Logistics, Audit, Events, and
Authorization authorities.

## CONSTITUTIONAL RULE

> Phase 22 may interpret, compose, explain, prepare, and route. It must not own
> procurement truth.

## CANONICAL FLOW

```text
Human
  ↓
Natural Language
  ↓
AI Translation
  ↓
Structured Procurement Intent
  ↓
Existing Capability Layer
  ├─ Phase 19 Discovery
  ├─ Phase 21 Supply Intelligence
  └─ Phase 20 Cross-Border Context
  ↓
Deterministic Procurement Context / Result
  ↓
Phase 22 Proposal / Preparation
  ↓
Existing Authorization
  ↓
Existing Procurement Authority
  ↓
Commerce / Inventory / Payment / Fulfillment / Logistics
```

## AUTHORITY RULES

### Phase 22 may not own

- Organization identity
- Product/Catalog truth
- Supplier participation, qualification, capability, or capacity truth
- Discovery candidates, ranking, or provenance
- Commodity or supply truth
- Cross-border feasibility or country regulatory truth
- Procurement Demand
- RFQ
- Supplier Response
- Procurement Comparison
- Procurement Award
- Purchase Order
- Commerce Order
- Inventory
- Payment or Settlement
- Fulfillment
- Logistics / Shipment
- Audit
- Events / Outbox
- Authorization

Each remains with its established canonical authority.

## AI RULES

AI may:

- interpret natural-language procurement requests;
- extract and normalize user-provided requirements;
- identify missing information;
- summarize deterministic evidence and results;
- explain why a deterministic result was produced;
- prepare non-authoritative procurement artifacts;
- propose actions for human/system authorization.

AI must not:

- invent suppliers, capacity, qualification, pricing, evidence, provenance, or compliance facts;
- generate or rank transaction candidates as an authoritative decision engine;
- decide cross-border feasibility or compliance;
- grant authorization;
- authorize payment;
- create an authoritative Procurement Demand, RFQ, Award, PO, Order, or Payment;
- execute a transaction directly;
- access the raw database;
- access provider credentials or secrets;
- bypass existing policy, approval, financial, validation, audit, or event controls.

## STATE / PERSISTENCE RULE

Phase 22 has no independent transaction/state authority.

`ProcurementIntent`, `ProcurementContext`, and `ProcurementProposal` are
request-scoped or derived unless a later phase proves that an existing
canonical authority cannot represent required durable truth.

No Phase 22 table, ledger, event store, supplier store, RFQ store, PO store, or
parallel transaction lifecycle is permitted by this constitution.

## DECISION RULE

Phase 22 does not replace deterministic procurement comparison.

```text
Existing deterministic comparison
          ↓
AI explanation / presentation
```

AI explanation may describe a deterministic result but cannot silently alter the
underlying comparison, ranking, award, or authorization decision.

## PROVENANCE RULE

AI-derived content must remain distinguishable from observed or verified domain
truth. In particular:

`UNKNOWN ≠ SUCCESS`

AI interpretation does not upgrade unknown evidence into verified evidence.

## AUTHORIZATION / EXECUTION RULE

The following distinctions are immutable:

`INTENT ≠ FEASIBILITY ≠ AUTHORIZATION ≠ EXECUTION`

A Phase 22 proposal is not an authorization. An authorization is not itself a
transaction. A transaction is executed only by the owning domain authority.

## INTEGRATION RULE

Where an external provider is involved, the existing controlled boundary remains:

```text
Canonical Contract → Adapter → External Provider
```

Phase 22 does not become a provider gateway, credential store, or provider
execution engine.

## DOWNSTREAM COMPATIBILITY

This constitution establishes the reusable boundary needed by:

- Phase 23 — AI Negotiation
- Phase 24 — Agent Commerce

Future phases must inherit the same separation between intent, context,
proposal, authorization, and execution rather than widening Phase 22 into a
transaction authority.

## EXIT DECISION

Phase 22.1 is complete when the constitution is present, internally consistent
with the Phase 22.0 baseline and existing AI/Procurement authorities, and the
regression verifies that no duplicate authority or direct AI execution boundary
has been introduced.
