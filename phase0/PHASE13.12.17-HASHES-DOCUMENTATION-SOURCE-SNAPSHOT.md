# Phase 13.12.17 — Hashes + Documentation + Source Snapshot

**Status:** PREPARED — FINAL EXIT BLOCKED PENDING PHASE 13.12.16 NODE >=24 CERTIFICATION

## Purpose

Prepare the reproducible Phase 13.12 security-gate source snapshot without falsely declaring Phase 13 complete while the required Node >=24 runtime certification remains outstanding.

## Exit dependency

Phase 13.12.16 must return **PASS** under a real Node.js >=24 runtime before this artifact may be promoted from PREPARED to FINAL EXIT.

The current execution environment is Node 22.16.0. Node 22 results are compatibility evidence only and are not promoted to Node >=24 certification.

## Completed chain

- Phase 13.12.0 → 13.12.15: PASS
- Phase 13.12.16: BLOCKED — runtime certification pending
- Phase 13.12.17: PREPARED — snapshot/hash/documentation exit package

## Authority invariants

The snapshot preserves the established authorities:

- Phase 10.3 canonical authorization authority
- canonical tenant and organization isolation
- canonical location-scope authority
- existing audit authority
- canonical vertical mutation enforcement
- existing approval workflow boundary
- existing versioned-event/outbox/consumer chain
- existing configuration authority
- no duplicate event broker/store
- no duplicate authorization evaluator/store
- no duplicate audit store
- no country-pack authority introduced

## Snapshot rules

1. Preserve source exactly as certified by the preceding phase except for this phase's documentation/test artifacts and handoff continuity update.
2. Generate SHA-256 entries for all phase 13.12.17-controlled artifacts.
3. Verify the generated manifest with `sha256sum -c`.
4. Do not hash the final ZIP inside its own manifest.
5. Do not alter historical phase hash manifests to force current equality.
6. Do not mark Phase 13 DONE until Phase 13.12.16 passes under Node >=24.

## Promotion rule

When a real Node >=24 runtime is available:

```text
npm run test:phase13.12.16
        ↓ PASS
verify 13.12.17 hash manifest
        ↓ PASS
promote this PREPARED snapshot to FINAL EXIT
        ↓
PHASE 13 DONE
        ↓
PHASE 14 COUNTRY PACKS
```
