# Remediation roadmap

## Principles

- Make small, reversible slices.
- Preserve external API behavior during refactors.
- Preserve tenant, authorization, transaction, and event guarantees.
- Prefer executable verification over documentation-only certification.
- Do not create duplicate authorities.

## Priority 1: establish current truth

1. Keep the architecture map and capability matrix aligned with current source and executable evidence.
2. Identify canonical owners for every major domain.
3. Mark features as implemented, partial, request-only, or not implemented.
4. Archive completed phase documents without deleting history.

## Priority 2: make the backend maintainable

1. Complete route inventory review, including all unclassified entries and handler behavior.
2. Build a route-to-handler map covering middleware, authorization, scope, errors, and side effects.
3. Create a SQLite persistence map covering tables, foreign keys, indexes, migration dependencies, transactions, call sites, and cross-domain invariants.
4. Select one genuinely bounded, low-risk slice only after those maps are reviewed.
5. Run the relevant regression gates after each extraction; do not infer module boundaries from route paths or function names alone.

## Priority 3: consolidate developer workflow

1. Add clear test, test:integration, test:security, test:e2e, and test:release entry points only after mapping existing scripts and CI gates.
2. Map existing phase scripts into those suites without deleting or renaming historical commands initially.
3. Publish expected runtime and required environment variables.
4. Make security and isolation tests fail closed.

## Priority 4: preserve and complete capacity evidence boundaries

1. Keep Logistics Scheduling request-only until a trusted resource/capacity and feasibility authority is explicitly established.
2. Preserve the current fail-closed time-bound Discovery matching checks for status, quality, observation time, validity, period overlap, quantity, and unit.
3. Review every other capacity consumer before allowing capacity evidence to drive time-sensitive operational decisions; do not assume all non-time-bound searches apply the same freshness checks.
4. Add independent OBSERVED or VERIFIED evidence only after a trusted observer identity, provenance contract, and authorization boundary exist.
5. Preserve immutable RFQ-time capacity evidence snapshots and the distinction between a supplier declaration, a matching result, and operational authorization.

## Priority 5: production readiness

1. Define environment separation and deployment runbook.
2. Add structured logs, request IDs, tenant context, health checks, and operational metrics where gaps are verified.
3. Define backup, restore, migration, rollback, and incident procedures.
4. Decide the long-term database strategy before SQLite becomes a scaling constraint.

## Definition of done

A remediation item is complete only when:

- The intended behavior is implemented.
- Relevant regression, security, isolation, and integration tests pass.
- Documentation reflects the actual behavior.
- No duplicate canonical authority is introduced.
- The change is reviewable in a focused pull request.


## Current-main audit delta (2026-11-23)

The first route and SQLite dependency maps and the test-command map are now available under `docs/audit/`. The immediate newly confirmed security priority is the missing central permission check on payment routing policy GET/POST routes. The capacity boundary also distinguishes the strict unified Discovery matcher from the legacy direct Supplier Network discovery endpoint. Keep Logistics Scheduling request-only; no extraction or operational capacity authority is approved.
