# Phase 16.8 — External Integration Gateway

## Status

**PASS under the available runtime; Node >=24 certification remains pending.**

## Objective

Introduce a controlled executable gateway boundary between external consumers and Sellify's canonical integration/capability/authority layers without creating a second API gateway, authentication system, authorization store, transaction engine, persistence layer, event store, broker, or domain authority.

## Canonical flow

`External Consumer → Integration Gateway → Integration Contract → Capability → Existing Authorization → Existing Authority`

Provider execution remains outside the gateway. Adapter metadata may identify a provider adapter, but the gateway does not own provider credentials or provider state.

## Implementation

Added `app/src/platform/integration-gateway.js`.

The gateway:

- validates integration, action, context, and payload shape;
- requires active inbound/bidirectional integration status;
- enforces tenant/country/regional scope requirements;
- verifies the operation is declared by the integration;
- verifies the action is exposed by the canonical capability;
- delegates authorization to the existing authorization policy;
- delegates execution only through a dependency-injected existing capability handler;
- returns the canonical authority identity and execution metadata;
- fails closed on unknown integrations, undeclared operations, missing scope, authorization denial, missing handlers, and forbidden infrastructure claims.

## Explicit non-ownership

The gateway owns none of the following:

- database/persistence
- credentials/secrets/token storage
- authorization or identity storage
- transaction engine
- ledger
- event store
- broker
- domain authority
- provider implementation

Existing transaction, authorization, outbox/event, tenant, organization, location, payment, inventory, commerce, customer, fulfillment, document, audit, country, and vertical authorities remain authoritative.

## Regression

`node phase0/phase16.8-integration-gateway-regression.mjs`

**12 PASS / 0 FAIL**

Cumulative compatibility gates:

- Phase 16.0 — 9 PASS / 0 FAIL
- Phase 16.1 — 30 PASS / 0 FAIL
- Phase 16.2 — 30 PASS / 0 FAIL
- Phase 16.3 — 32 PASS / 0 FAIL
- Phase 16.4 — 36 PASS / 0 FAIL
- Phase 16.5 — 33 PASS / 0 FAIL
- Phase 16.6 — 35 PASS / 0 FAIL
- Phase 16.7 — PASS
- Phase 15.20 — 126 PASS / 0 FAIL

## Runtime note

The repository continues to require Node `>=24`. The available runtime is Node 22.16.0, so this implementation is not a Node >=24 certification. The existing `MODULE_TYPELESS_PACKAGE_JSON` warning is unchanged.
