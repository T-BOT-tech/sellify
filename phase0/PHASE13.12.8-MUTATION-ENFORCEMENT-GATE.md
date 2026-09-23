# Phase 13.12.8 — Mutation Enforcement Gate

## Purpose

Prove that a Phase 13 vertical capability cannot execute a state-changing
mutation through the server boundary unless the canonical Phase 10.3
authorization decision is `ALLOW`.

The gate is intentionally narrow:

```text
Tenant / Location Scope
        ↓
Vertical Capability Authorization
        ↓
ALLOW?
   ├── NO  → mutation MUST NOT execute
   └── YES → existing canonical mutation capability executes
```

## Implementation

`backend/lib/vertical-mutation-enforcement.js` is a server-side execution
adapter. It composes the existing Phase 13.12.7 capability authorization
boundary and accepts only an injected existing canonical mutation capability.

The adapter does not become an authority for Commerce, Inventory,
Fulfillment, Payments, Orders, Stock, or any vertical persistence.

## Enforcement rules

1. Tenant scope is checked by the existing canonical tenant-isolation module.
2. Location scope is checked by the existing canonical location boundary.
3. The vertical resource/action is resolved by the Phase 13.12.3 registry.
4. Undefined vertical policy remains fail-closed.
5. The final policy decision remains delegated to Phase 10.3 `authorize()`.
6. Only `AUTHZ.ALLOW` permits the mutation callback to execute.
7. `DENY` and `REQUIRES_APPROVAL` never execute the mutation callback.
8. The mutation capability is injected; this gate does not persist or mutate
   state itself.
9. No vertical module receives direct SQL/database authority through this
   phase.

## Current vertical mutation posture

The Phase 13 vertical application modules are contract/bridge modules. Their
mutation-capable functions delegate to injected canonical core capabilities,
for example Commerce order creation and Inventory stock movement. There are
no Phase 13 vertical backend routes in `backend/server.js` at this baseline.
Therefore this phase establishes the mandatory server execution gate rather
than inventing or duplicating vertical route handlers.

## Regression coverage

The regression proves:

- authorized capability executes exactly once;
- denied capability never executes;
- vocabulary-only capability never executes even for the owner wildcard;
- foreign organization is denied before mutation;
- foreign location is denied before mutation;
- unknown capability is denied before mutation;
- `REQUIRES_APPROVAL`, when surfaced by central policy, is not executed by
  this pre-approval gate;
- the existing canonical mutation callback remains the only mutation owner;
- vertical source contains no direct database/SQL persistence implementation;
- no second authorization, mutation, approval, audit, event, or configuration
  authority is introduced;
- existing Phase 13.12.0–13.12.7 and Phase 0 golden regressions remain intact.

## Not pulled forward

- approval workflow/enforcement — Phase 13.12.9;
- sensitive audit enforcement — Phase 13.12.10;
- API attack testing — Phase 13.12.11;
- events/outbox — Phase 13.14;
- pack configuration — Phase 13.13.

## Exit invariant

No server-side Phase 13 vertical mutation may execute before canonical
authorization has returned `ALLOW`.
