# Phase 16.13 — Node >=24 Certification

## Status
BLOCKED — the current execution environment is Node `v22.16.0`; no Node >=24 certification is claimed.

## Objective
Certify the completed Phase 16.0–16.12 platform boundary under the project's declared supported runtime, Node `>=24`.

## Source of truth
The Phase 16.12 verified source snapshot remains authoritative for implementation behavior. This phase adds only a runtime certification gate; it does not rewrite or replace existing platform/domain code.

## Certification contract

A supported-runtime certification requires all of the following in the **same Node >=24 runtime**:

1. `package.json` declares `engines.node = ">=24"`.
2. `backend/package.json` declares `engines.node = ">=24"`.
3. Phase 16.12 cumulative platform regression passes.
4. Phase 0 Golden Regression passes as part of Phase 16.12.
5. The actual runtime major version is `>=24`.
6. The result is recorded with the exact runtime version.

Node 22 compatibility evidence must never be promoted to Node >=24 certification.

## Non-goals

- No Node engine downgrade.
- No replacement of `node:sqlite`.
- No migration.
- No package-manager or dependency rewrite.
- No domain-engine rewrite.
- No new identity, authorization, inventory, payment, transaction, event, broker, or persistence authority.

## Current verification

Observed runtime:

```text
Node v22.16.0
```

Phase 16.12 compatibility regression under this runtime: **PASS**.

Node >=24 certification: **BLOCKED BY RUNTIME**.

This is an environment gate, not evidence of a source-code failure.

## Exit condition

Phase 16.13 becomes PASS only after rerunning `npm run test:phase16.13` on a real Node.js `>=24` runtime and obtaining a successful Phase 16.12 cumulative regression in that same runtime.

Next: **Phase 16.14 — Final Platform Snapshot**.
