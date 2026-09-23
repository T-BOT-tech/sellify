# Phase 13.12.13 — Pack Configuration

**Status:** COMPLETE

## Objective

Formalize vertical-pack configuration as a deterministic, persistence-neutral
composition boundary while preserving the existing configuration authority.

## Scope

This increment owns:

- configuration schema/contract for vertical-pack activation
- defaults
- configuration precedence
- organization-level overrides
- location-level overrides
- explicit runtime overrides
- pack enablement interpretation
- configuration validation and scope isolation

It does **not** create a configuration database, tenant configuration table,
second state store, authorization evaluator, event store, or outbox.

## Existing authority preserved

The existing persisted configuration authority remains:

```text
app/src/state.js#config
        ↓
STORAGE_KEYS.config
```

Existing feature consumers remain unchanged. The new contract is additive and
currently has no persistence side effects.

## Pack activation semantics

| Pack | Current activation authority | Default |
|---|---|---|
| Agriculture | Declarative pack only; no existing feature switch | Not synthesized |
| Restaurant | `config.businessModel === 'restaurant'` | disabled outside restaurant mode |
| Warehouse | `config.warehouseEnabled` | false |
| Logistics | `config.logisticsEnabled` | false |

No new Agriculture feature flag is invented in this increment.

## Precedence

```text
defaults
   ↓
existing persisted config
   ↓
organization override
   ↓
location override
   ↓
explicit runtime override
```

The resolver is pure and does not write any layer back to storage.

## Isolation rules

- Unknown pack IDs fail closed.
- Organization-scoped overrides must match the requested organization scope
  when an expected scope is supplied.
- Location-scoped overrides must match the requested organization/location
  scope when expected values are supplied.
- Only the contract's supported configuration keys are composed.
- Configuration does not grant permissions and cannot bypass Phase 13.12
  authorization gates.

## Explicit non-changes

- `app/src/state.js` remains the configuration persistence authority.
- Existing Warehouse and Logistics configuration contracts remain intact.
- Existing Restaurant business-model behavior remains intact.
- Agriculture receives no invented feature switch.
- No event/outbox implementation is pulled forward from Phase 13.12.14.
- No authorization implementation is added; Phase 10.3 remains canonical.
- No country-specific configuration is introduced.
