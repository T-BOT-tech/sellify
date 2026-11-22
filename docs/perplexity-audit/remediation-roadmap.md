# Remediation roadmap

## Principles

- Make small, reversible slices.
- Preserve external API behavior during refactors.
- Preserve tenant, authorization, transaction, and event guarantees.
- Prefer executable verification over documentation-only certification.
- Do not create duplicate authorities.

## Priority 1: establish current truth

1. Create a concise architecture map and current-capability matrix.
2. Identify canonical owners for every major domain.
3. Mark features as implemented, partial, request-only, or not implemented.
4. Archive completed phase documents without deleting history.

## Priority 2: make the backend maintainable

1. Extract shared HTTP middleware and route registration.
2. Split routes by domain.
3. Create a persistence inventory for SQLite.
4. Extract one bounded store domain at a time.
5. Run all relevant regression gates after each extraction.

## Priority 3: consolidate developer workflow

1. Add `test`, `test:integration`, `test:security`, `test:e2e`, and `test:release` entry points.
2. Map existing phase scripts into those suites.
3. Publish expected runtime and required environment variables.
4. Make security and isolation tests fail closed.

## Priority 4: resolve capacity and scheduling

1. Adopt the request-only scheduling boundary until a trusted authority exists.
2. Add evidence freshness, validity, quality, and provenance fields only where the existing schema requires them.
3. Enforce fail-closed behavior for stale or unknown evidence.
4. Prevent supplier self-assertion of verified evidence.
5. Disable or hide unauthorized scheduling transitions in the UI.

## Priority 5: production readiness

1. Define environment separation and deployment runbook.
2. Add structured logs, request IDs, tenant context, health checks, and operational metrics.
3. Define backup, restore, migration, rollback, and incident procedures.
4. Decide the long-term database strategy before SQLite becomes a scaling constraint.

## Definition of done

A remediation item is complete only when:

- The intended behavior is implemented.
- Relevant regression, security, isolation, and integration tests pass.
- Documentation reflects the actual behavior.
- No duplicate canonical authority is introduced.
- The change is reviewable in a focused pull request.
