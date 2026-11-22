# Test consolidation plan

## Problem

The root `package.json` exposes a very large number of individual phase-specific npm scripts.

This makes it difficult for a contributor to understand what must run before a change, what is fast feedback, and what constitutes a release gate.

## Target command surface

```text
npm run test              # proposed fast unit, contract, and focused regression suite
npm run test:integration  # API, persistence, event, and cross-domain tests
npm run test:security     # authorization, tenant isolation, adversarial, and API boundary tests
npm run test:e2e          # browser and critical user journeys
npm run test:release      # full Node 24 and release certification gate
```

## Current repository state

The root package currently defines 482 npm scripts. It does not yet define the proposed `test`, `test:integration`, `test:security`, `test:e2e`, or `test:release` scripts. These are proposed entry points, not currently runnable commands. Invoke colon-named scripts through `npm run <script-name>`; do not use `npm test:integration` syntax.

## Implementation approach

1. Create a test manifest that maps existing scripts into suites.
2. Add wrapper scripts; do not delete or rename existing scripts initially.
3. Group tests by execution cost and risk.
4. Make `npm test` fast enough for routine development.
5. Make `npm test:release` deterministic, comprehensive, and suitable for CI.
6. Publish expected duration and required environment variables for each suite.

## Suite mapping

| Suite | Includes | When to run |
|---|---|---|
| Fast | Pure contract, unit, and small regression tests | Every code change |
| Integration | HTTP, store, migration, event, and cross-domain tests | Before opening a PR |
| Security | Authorization, tenant isolation, escalation, API boundary, and sensitive-action tests | Before merging security-sensitive changes |
| E2E | Browser, Telegram, storefront, checkout, and critical journeys | Before merging user-facing changes |
| Release | Node 24 verification, cumulative gates, hashes, and final certification | Before release or risky merge |

## Quality gates

- No test may silently skip because of a missing environment variable without an explicit reason.
- Security and tenant-isolation tests must fail closed.
- Every new canonical authority must have authorization, isolation, idempotency, and adverse-input coverage.
- Every user-facing workflow must define its minimum browser and accessibility coverage.
- Release certification must distinguish verified behavior from documentation-only claims.
