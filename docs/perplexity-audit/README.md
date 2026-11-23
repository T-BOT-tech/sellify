# Perplexity independent codebase audit

## Scope

This directory contains an independent architecture and remediation assessment for Sellify.

The documents in this directory are additive and do not modify application source, tests, migrations, or existing phase documentation. The associated pull request also adds static inventory tools, CI/configuration changes, a bounded shared HTTP response helper, the missing Payment production-certification route handler, and focused HTTP regressions. The overall pull request is therefore an audit plus a narrowly scoped implementation, not documentation-only.

## Deliverables

- `architecture-map.md`: current repository map, technology inventory, domain ownership, and structural risks.
- `backend-modularity-plan.md`: low-risk decomposition plan for `backend/server.js` and `backend/lib/store-sqlite.js`.
- `test-consolidation-plan.md`: unified test entry points and release gates.
- `capacity-scheduling-adr.md`: decision record for capacity evidence, freshness, and Logistics Scheduling authority.
- `remediation-roadmap.md`: prioritized implementation sequence.

## Guardrails

- Preserve existing external API behavior unless a change is explicitly approved.
- Preserve tenant, organization, location, role, and authorization boundaries.
- Preserve transactional integrity and event/idempotency guarantees.
- Do not create duplicate canonical authorities for inventory, fulfillment, payment, scheduling, capacity, or provider execution.
- Make backend refactors incrementally, with existing regression gates passing after each slice.


## Current-main audit refresh (2026-11-23)

The current source-derived audit artifacts are maintained in `docs/audit/`:

- `architecture-map.md`
- `capability-investment-matrix.md`
- `wave0-baseline.md`
- `remediation-roadmap.md`
- `route-characterization.md` / `.json`
- `sqlite-dependency-map.md` / `.json`
- `test-command-map.md` / `.json`
- `capacity-scheduling-boundary.md`

The earlier Perplexity audit documents and run evidence remain historical records; current-state changes are additive and do not rewrite their recorded branch SHAs or CI results.
