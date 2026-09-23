# Phase 16.11 — Platform Security

## Status
PASS — implementation and regression gate complete.

## Purpose
Harden the Phase 16 platform surface without creating a second security or identity authority.

## Security flow
Platform Consumer → Platform Security Boundary → Existing Tenant/Country/Vertical Boundaries → Existing Authorization → Existing Domain Authority

## Implemented
- `app/src/platform/platform-security.js`
- public exports through `app/src/platform/index.js`
- `phase0/phase16.11-platform-security-regression.mjs`
- `package.json` script `test:phase16.11`

## Existing authorities preserved
- authenticated session / identity authority
- `backend/lib/security-context.js`
- `backend/lib/tenant-isolation.js`
- `backend/lib/country-security-isolation.js`
- `backend/lib/country-security-expansion.js`
- `backend/lib/authorization.js`
- existing vertical authorization/configuration
- existing domain transaction authorities
- existing outbox/event authorities

## Security properties
- fail closed for invalid security context
- fail closed for inactive/candidate/regional-only country composition
- capability/action must be declared
- tenant and organization scope remains canonical
- authorization remains canonical
- credentials/secrets are never owned or stored
- no database/persistence/ledger/event-store/broker/transaction-engine authority
- no second permission matrix
- no second identity/session/membership store

## Regression
Phase 16.11: 30 PASS / 0 FAIL.
Phase 15.20 compatibility gate: PASS — 126/126.

Node >=24 remains a separate certification requirement. Current environment is Node 22.16.0, so this phase does not claim Node >=24 certification.
