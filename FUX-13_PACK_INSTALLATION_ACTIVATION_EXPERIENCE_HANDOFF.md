# FUX-13 — Pack Installation / Activation Experience Handoff

## Status

**EXPERIENCE CONTRACT IMPLEMENTED — CANONICAL LIFECYCLE MUTATION DEFERRED**

FUX-13 is implemented as a product-experience contract over the actual SELLIFY source. It does not invent a Pack lifecycle store/API.

## Scope

The contract covers the FUX-required lifecycle concepts:

- eligibility
- dependency blocking
- installation
- activation
- deactivation
- upgrades
- authorization-required states
- recovery
- UNKNOWN

## Canonical authorities preserved

- Existing configuration: `app/src/state.js#config`
- Existing Pack readiness: `app/src/authorization/pack-readiness.js`
- Existing entitlement/configuration evidence: `app/src/authorization/pack-entitlement.js`
- Server authorization: `backend/lib/authorization.js`
- Existing audit/event boundary remains authoritative

No Pack lifecycle mutation endpoint, persistence store, or second authorization authority was introduced.

## Important limitation

The current source explicitly states that no canonical Pack lifecycle store/API exists for executable install/activate/deactivate controls. Therefore FUX-13 does **not** expose fake mutation controls or locally persisted activation state.

Mutation actions are represented as `UNAVAILABLE_PENDING_CANONICAL_LIFECYCLE_AUTHORITY` rather than being fabricated.

## Verification

- FUX-13 regression: PASS
- P1-10: PASS
- P1-12: PASS
- P1-13: PASS
- P1-14: PASS
- P1-15: PASS
- P1-16: PASS
- P1-21: PASS
- P1-22: **27 PASS / 0 FAIL**
- Golden Regression: **21 PASS / 0 FAIL**

## Certification gate

Final certification remains deferred until the existing Node >=24 runtime gate is executed successfully. No Node 22 evidence is promoted to Node >=24 certification.
