# Phase 15.21 — Node >=24 Full Regression

## Purpose

Run the Phase 15 cross-country regression gate under a real Node.js >=24 runtime and certify the release only when the runtime requirement is actually satisfied.

## Contract

- `package.json` remains `engines.node = ">=24"`.
- Phase 15.20 is the compatibility preflight.
- Node 22 may execute the preflight but is never promoted to Node >=24 certification.
- No runtime requirement is lowered to make the gate pass.

## Current Environment

The current execution environment reports Node.js `v22.16.0`.

Therefore Phase 15.21 is **BLOCKED**, not PASS.

## Certification Rule

Certification requires `Number(process.versions.node.split('.')[0]) >= 24` and a successful Phase 15.20 regression gate in that same runtime.
