# P1-IMPLEMENTATION-13 — Pack Dependency & Readiness UX

## Scope

Adds a read-only Pack dependency/readiness surface. It distinguishes:

- `DEPENDENCY_UNAVAILABLE`
- `CONFIGURATION_INACTIVE`
- `DECLARATIVE_ONLY`
- `JOURNEY_UNAVAILABLE`
- `READY`

The implementation uses the existing vertical Pack contract and existing configuration authority. Core dependency availability is derived from the canonical `CORE_AUTHORITIES` list in `app/src/verticals/contract.js`.

## Boundaries

- Does not create Pack activation state.
- Does not create entitlement persistence.
- Does not create an authorization evaluator.
- Does not grant user access.
- Does not create a second journey authority.
- `backend/lib/authorization.js` remains the authorization authority.
- `app/src/state.js#config` remains the configuration authority.

Executable journey readiness is based on whether the current Pack contract declares a `ui_entry_point`; it does not claim that a missing entry point can be activated by this surface.

## Changed files

- `app/src/authorization/pack-readiness.js`
- `app/src/ui/settings.js`
- `app/index.html`
- `phase0/p1-13-pack-dependency-readiness-regression.mjs`
- this implementation record

## Validation

- Node syntax checks: PASS
- P1-13 focused regression: PASS
- FUX-29 seller golden journey regression: PASS
- FUX-30 multi-channel adversarial regression: PASS

The environment reports existing `MODULE_TYPELESS_PACKAGE_JSON` warnings. Node >=24 runtime certification remains a separate release gate.
