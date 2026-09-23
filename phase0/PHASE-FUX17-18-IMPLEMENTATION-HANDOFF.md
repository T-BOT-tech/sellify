# FUX-17/FUX-18 Implementation Handoff

## CURRENT PHASE
FUX-17 Notifications + FUX-18 Product Analytics & UX Observability

## OBJECTIVE
Add the smallest additive experience contract needed to productize notification classification, read/acknowledgement state, deduplication, preferences/quiet periods, provider-adapter delivery boundaries, and UX observability signals while preserving existing canonical event, audit, and offline-outbox authorities.

## SOURCE INSPECTION
Inspected the actual consolidated source before changes, including:
- `app/src/events/event-boundary.js`
- `app/src/platform/event-outbox-platform.js`
- `app/src/audit/audit-boundary.js`
- `app/src/sync/outbox.js`
- `app/src/authorization/pack-analytics.js`
- `app/src/ui/settings.js`
- `app/index.html`
- existing FUX-13 through FUX-16 experience contracts and regressions

No existing notification store/provider authority was found in the inspected source. Existing observability evidence is anchored in the canonical audit/event/outbox boundaries.

## CURRENT STATE
Before this slice, FUX-17/FUX-18 had no dedicated experience contract. Existing source already provided:
- canonical versioned event envelope and durable outbox;
- canonical audit persistence boundary;
- offline command/event queue;
- read-only Pack analytics over canonical audit evidence.

## SOURCE OF TRUTH
The consolidated SELLIFY source remains authoritative. This continuation only adds an experience boundary over existing authorities.

## PROPOSED CHANGE
Added `app/src/experience/notifications-observability-contract.js` with:
- notification taxonomy: informational, action-required, approval-required, failure/recovery, security, operational;
- notification priority/read/delivery states;
- deterministic notification deduplication key handling;
- acknowledgement/read requirements without introducing persistence;
- optional user preference + quiet-period evaluation;
- provider adapter contract that is delivery-only and persistence-free;
- observability signal envelope covering activation, completion, error, latency, abandonment, retry, offline queue depth, sync failure, permission friction and recovery;
- explicit request/correlation/operation/capability/actor/organization/status/latency/error context;
- offline queue observability mapping to the existing `app/src/sync/outbox.js` authority;
- boundary assertions preventing duplicate notification, analytics, telemetry, audit, event or transaction authorities.

Added `phase0/fux17-18-notifications-observability-regression.mjs` and the npm script `fux17-18:notifications-observability-test`.

## FILES TO CHANGE
- `app/src/experience/notifications-observability-contract.js`
- `phase0/fux17-18-notifications-observability-regression.mjs`
- `phase0/PHASE-FUX17-18-IMPLEMENTATION-HANDOFF.md`
- `package.json`

## MIGRATION
None. This slice is additive and persistence-neutral. No schema, endpoint, event store, audit store, notification store, analytics store, transaction engine, authorization authority, or provider integration was introduced.

## TEST PLAN
Focused regression:
- syntax checks for the new module and regression;
- FUX-17/FUX-18 regression;
- existing FUX-13 through FUX-16 regressions;
- existing audit/observability regression;
- Golden Regression where runtime permits.

## RISKS
- Existing source has no canonical notification persistence/provider implementation; this slice therefore intentionally stops at the experience/adaptor contract.
- Quiet periods are evaluated only when supplied; no user-preference persistence is invented.
- Observability envelopes are evidence mappings, not a telemetry backend.
- Node >=24 release certification remains unresolved in the current runtime.

## IMPLEMENTATION RESULT
Implemented the bounded FUX-17/FUX-18 experience slice without creating a parallel architecture.

## VERIFICATION
The new FUX-17/FUX-18 regression passes under the available runtime. The runtime reports Node `v22.16.0`; therefore the repository's Node `>=24` certification gate remains BLOCKED and no final certification is claimed.

## NOT CHANGED / WHY
- Existing event/outbox/audit implementations were not rewritten because they are already canonical authorities.
- Backend notification delivery was not invented because no canonical notification provider contract exists in the inspected source.
- Existing Pack analytics was not replaced because it already reads canonical audit evidence.
- No new persistence schema or provider SDK was added because FUX explicitly prohibits duplicate messaging/telemetry authority.

## NEXT STEP
Proceed to FUX-19/FUX-20 only after the FUX-17/FUX-18 boundary is retained: experimentation and analytics must consume canonical evidence and must not become hidden authorization, transaction, event-store, or telemetry authorities.
