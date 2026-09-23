# Phase 13.12.0 — Security Gate Baseline / Re-lock

**Status:** COMPLETE — 2026-09-08

## Objective

Re-lock the Phase 13 cross-pack architecture before security enforcement work.
Phase 13.12 is an authorization/security enforcement and certification gate; it
must not create a second authorization system or absorb Phase 13.13 configuration
or Phase 13.14 event/outbox implementation.

## Starting snapshot

`SELLIFY_PHASE13_11_21_SNAPSHOT_EXIT_2026-09-08.zip`

The Phase 13.11.21 snapshot is the only approved starting source for Phase 13.12.

## Canonical authorization authority

Phase 10.3 remains authoritative through:

```text
authorize(actor, organization, location, resource, action)
  → ALLOW | DENY | REQUIRES_APPROVAL
```

Implementation authority:

```text
backend/lib/authorization.js
```

Authentication/session authority remains the existing session, membership, and
device model in `backend/lib/store-sqlite.js` / `backend/server.js`.

## Phase 13.12 scope

Phase 13.12 owns only:

- authorization enforcement
- actor/security context
- organization isolation
- location scope
- role/resource/action enforcement
- approval boundaries
- unauthorized API mutation protection
- cross-pack privilege-escalation protection
- sensitive/denied authorization audit evidence
- authorization/security architecture lint
- adversarial authorization testing

## Explicit non-scope

Phase 13.12 does **not** implement:

- pack configuration (Phase 13.13)
- configuration precedence/defaults/overrides (Phase 13.13)
- event publication or new event consumers (Phase 13.14)
- new outbox/event stores/brokers (Phase 13.14)
- replacement authentication/session storage
- a second role/permission registry
- vertical-specific authorization persistence
- route/dispatch implementation

## Existing security anchors confirmed

- Central authorization policy: `backend/lib/authorization.js`
- Tenant/org/location policy: `backend/lib/tenant-isolation.js`
- Server authorization boundary: `backend/server.js`
- Canonical audit persistence: existing `audit_events` path
- Existing session/membership/device authority: `backend/lib/store-sqlite.js`
- Existing Phase 13 cross-pack authority and integration contracts remain intact

## Migration rule

No destructive security migration is introduced by this re-lock.
Future enforcement changes must follow the project migration discipline:

```text
Add → Dual-read → Dual-write → Verify → Switch → Deprecate → Remove
```

## Exit condition

Phase 13.12.0 is complete when the current snapshot is proven to contain the
canonical authorization authority and Phase 13.11 security controls, while
Phase 13.13 configuration and Phase 13.14 event/outbox responsibilities remain
unimplemented by this phase.
