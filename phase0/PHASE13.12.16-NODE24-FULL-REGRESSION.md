# Phase 13.12.16 — Node >=24 Full Regression

## Purpose

Phase 13.12.16 is the runtime certification gate for the completed Phase 13.12
security/composition chain. It must execute the Phase 13.12.0 → 13.12.15
regression chain under an actual Node.js major version >=24.

## Runtime source of truth

- `package.json#engines.node` MUST remain `>=24`.
- The certification runtime is `process.versions.node`, not a declaration,
  emulator, or compatibility assumption.
- Node 22 execution may be used as a compatibility preflight but MUST NOT be
  represented as Node >=24 certification.

## Current execution environment

The available execution runtime for this snapshot is Node 22.16.0.
Node.js 24.20.0 LTS is the current Node 24 LTS release documented by the
official Node.js download/archive pages. The container cannot resolve the
Node.js download host, so a real Node 24 binary could not be installed during
this gate.

Therefore this phase is intentionally **BLOCKED**, not falsely certified.

## Preflight performed

The gate verifies:

1. `package.json#engines.node === ">=24"`.
2. The complete Phase 13.12.0 → 13.12.15 control chain is present.
3. The Node 22 compatibility preflight can execute the completed gate chain.
4. Phase 0 Golden Regression remains green.

## Certification rule

The gate returns exit code `2` when `process.versions.major < 24`.
Exit code `0` is reserved for real Node >=24 certification.

## No architecture changes

This phase does not change authorization, identity, tenant/location scope,
audit, configuration, event/outbox, or domain authorities. It is runtime
certification only.
