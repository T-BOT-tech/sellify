# Phase 13.12.2 — Security Context Contract

**Status:** COMPLETE — 2026-09-08  
**Scope:** Normalize the security context that reaches the existing Phase 10.3 authorization authority without creating another identity, session, tenant, role, permission, audit, or policy system.

## Objective

Establish one explicit contract for security identity, tenant scope, location scope and request/observability metadata:

```text
Actor / authenticated session
  → Security Context
  → Organization + Location scope
  → Phase 10.3 authorize(actor, organization, location, resource, action)
  → ALLOW | DENY | REQUIRES_APPROVAL
```

The context is a **contract, not an authority**. It does not authenticate, authorize, persist, or mutate.

## Actual source inspected

The implementation was based on the current Phase 13.12.1 source, including:

- `backend/lib/authorization.js`
- `backend/lib/tenant-isolation.js`
- `backend/server.js`
- `backend/lib/store-sqlite.js`
- `app/src/auth/tenant.js`
- `app/src/audit/audit-boundary.js`
- `SELLIFY_AI_HANDOFF.md`
- Phase 13.12.1 authorization authority inventory and regression

## Canonical context

### Security identity and scope

| Field | Meaning | Authority |
|---|---|---|
| `actorId` | authenticated user identity | existing user/session model |
| `sessionId` | authenticated session identity | existing sessions |
| `deviceId` | authenticated device identity | existing devices |
| `role` | membership role used by Core policy | existing membership + Phase 10.3 policy |
| `chatId` | legacy tenant/channel boundary | existing tenant/session model |
| `organizationId` | canonical organization scope | existing organization/tenant mapping |
| `locationId` | optional location scope | existing locations |

### Observability / transaction correlation metadata

| Field | Meaning | Authority |
|---|---|---|
| `requestId` | request-level trace identifier | request/runtime boundary when supplied |
| `correlationId` | business-operation correlation | existing application/event/audit conventions |
| `causationId` | causal predecessor | existing event/audit conventions |
| `eventId` | event identity when applicable | existing event boundary |
| `idempotencyKey` | replay/idempotency key when applicable | existing capability boundary |
| `externalSystem` | external provider/system identifier | integration boundary |
| `externalObjectId` | external object identifier | integration boundary |

Observability metadata is never a substitute for actor identity, organization scope or authorization.

## Implementation

Added:

- `backend/lib/security-context.js`
- `phase0/phase13.12.2-security-context-contract-regression.mjs`
- `phase0/PHASE13.12.2-SECURITY-CONTEXT-CONTRACT.md`
- `test:phase13.12.2` package script

The new module provides:

- `buildSecurityContext(session, options)` — pure normalization only
- `validateSecurityContext(context, options)` — contract validation only
- `securityContextContract()` — architecture metadata

The builder preserves existing session fields and accepts optional tenant,
organization and location objects plus request/correlation metadata. It does
not read or write the database.

## Compatibility rule

The existing API remains unchanged:

```text
authorize(actor, organization, location, resource, action)
```

No call-site migration is required by 13.12.2. Existing `requireAuthorization()`
continues to enforce tenant scope and then delegates to the canonical
`authorize()` policy.

## Security rule

The minimum authenticated context is:

```text
actorId + sessionId + chatId + organizationId + role
```

`locationId` becomes required only when the protected capability explicitly
requires location scope.

Missing identity or organization scope is invalid. Observability identifiers
may be absent; they cannot make an otherwise invalid context authorized.

## Deliberately not changed

- `backend/lib/authorization.js` — remains the sole authorization evaluator.
- `backend/lib/store-sqlite.js` — remains the identity/session persistence authority.
- `backend/lib/tenant-isolation.js` — remains the tenant/location policy boundary.
- `app/src/audit/audit-boundary.js` — remains the audit contract.
- Vertical pack authorization metadata — remains declarative metadata only.
- No role table.
- No permission table.
- No authorization database.
- No authentication replacement.
- No event/outbox implementation — Phase 13.14.
- No pack configuration implementation — Phase 13.13.

## Exit criterion

Phase 13.12.2 passes when the repository has an explicit, validated security
context contract that can carry the existing identity/scope and observability
fields into the canonical authorization boundary without creating a competing
authority.
