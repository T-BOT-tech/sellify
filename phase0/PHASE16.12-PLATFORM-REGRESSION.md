# Phase 16.12 — Platform Regression

## Status
IMPLEMENTED — cumulative regression gate added; Node >=24 certification remains a separate Phase 16.13 gate.

## Purpose

Phase 16.12 is the non-destructive regression gate for the completed Phase 16 platform boundary. It verifies that the platform layers added in 16.0–16.11 compose with existing Sellify authorities without creating a second identity, authorization, persistence, transaction, ledger, event-store or broker authority.

This phase does **not** introduce a new runtime architecture, migration, database, provider integration, or replacement of existing domain behavior.

## Source of truth

The supplied `SELLIFY_PHASE16_11_PLATFORM_SECURITY_2026-09-09.zip` is authoritative for implemented behavior. The gate executes the existing Phase 16.0–16.11 regression controls against that source tree and then executes the existing Phase 0 Golden Regression.

## Regression chain

```text
Phase 16.0 Baseline Lock
        ↓
16.1 Canonical Capability Contracts
        ↓
16.2 Authority Registry
        ↓
16.3 Adapter Framework
        ↓
16.4 Integration Contracts
        ↓
16.5 Capability Discovery
        ↓
16.6 Contract Versioning
        ↓
16.7 Event / Outbox Platformization
        ↓
16.8 External Integration Gateway
        ↓
16.9 Tenant / Country / Vertical Composition
        ↓
16.10 AI Capability Boundary
        ↓
16.11 Platform Security
        ↓
16.12 Platform Regression Gate
        ↓
Phase 0 Golden Regression
```

## Gate requirements

- `package.json` continues to declare Node `>=24`.
- All completed Phase 16 regression scripts remain executable.
- The public platform boundary remains exported through `app/src/platform/index.js`.
- Platform modules remain non-owning: no platform database, persistence layer, ledger, transaction engine, event store, broker, credential store, or second authorization/identity authority.
- Platform capability and adapter layers remain delegation-only.
- Integration gateway remains authorization- and scope-bounded.
- Tenant/country/vertical composition remains fail-closed and non-persistent.
- AI remains structured-intent/capability based and cannot access raw database state or credentials.
- Platform security continues to delegate to existing authorization and scope authorities.
- Existing Phase 0 Golden Regression remains green.

## Explicit non-goals

Phase 16.12 does not:

- rewrite `backend/server.js` or `backend/lib/store-sqlite.js`;
- replace SQLite or existing domain stores;
- add a new migration;
- add a new payment, inventory, marketplace, identity, authorization, event, or transaction core;
- add live external provider integrations;
- change country or vertical ownership rules;
- move commerce logic into the platform kernel;
- claim Node >=24 certification.

## Runtime note

The repository requirement is Node `>=24`. The current execution environment available during this implementation is Node `v22.16.0`. Therefore the regression results obtained here are compatibility evidence only; Phase 16.13 remains the required real Node >=24 certification gate.

## Exit condition

Phase 16.12 may be marked regression-pass only when the cumulative Phase 16.0–16.11 controls and Phase 0 Golden Regression execute successfully. Supported-runtime certification remains independently gated by Phase 16.13.
