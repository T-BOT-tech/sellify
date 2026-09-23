# Phase 13.12.15 — Phase 13 Regression Gate

## Status

**COMPLETE — 2026-09-09**

Phase 13.12.15 is the integrated security/composition gate for the complete
Phase 13.12 chain. It does not create a new authority. It certifies that the
completed 13.12.0–13.12.14 controls compose around the existing Phase 10.3
authorization, tenant/location, audit, configuration, event/outbox, and domain
persistence authorities.

## Gate scope

The gate verifies:

1. Phase 13.11.21 snapshot/exit continuity remains present and reproducible.
2. Phase 13.12.0 through 13.12.14 executable controls are all registered.
3. Canonical authorization remains `backend/lib/authorization.js`.
4. Security context, resource/action registry, role matrix, tenant/location
   isolation, vertical capability authorization, mutation enforcement,
   approval boundary, sensitive audit boundary, API attack tests, and
   cross-pack escalation controls remain present.
5. Pack configuration remains owned by the existing configuration authority.
6. Event/outbox integration remains composed over the existing versioned event,
   outbox, and backend consumer authorities.
7. No second authorization evaluator, tenant authority, audit store, event
   store/broker, configuration store, or cross-pack domain authority exists.
8. The four vertical packs remain the only Phase 13 pack boundaries.
9. `package.json` continues to require Node `>=24`.
10. The Phase 0 Golden Regression remains green.

This is an integration/certification gate, not Node >=24 runtime certification;
that remains Phase 13.16.

## Historical baseline handling

The Phase 13.12.0–13.12.2 controls contain historical baseline assertions about
what was deferred at the time they were created. Those records are retained as
historical controls and are not rewritten. This gate evaluates the current
completed architecture and separately confirms that 13.12.13 and 13.12.14 are
now present.

## Exit rule

Phase 13.12.15 passes only when all chain controls, authority-boundary checks,
Phase 13.11.21 continuity, Node requirement preservation, and Phase 0 Golden
Regression pass. No implementation authority is moved or duplicated by this
subphase.
