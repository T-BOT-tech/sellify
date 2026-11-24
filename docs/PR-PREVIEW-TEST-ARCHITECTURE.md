# Sellify PR Preview and Test Environments

Status: implemented on `feature/workforce-capability-20261124`; awaiting profile-matrix verification and explicit review  
Scope: GitHub Actions CI and synthetic test environments only  
Non-goals: production deployment, production data access, persistent preview hosting, or paid preview services

## Design decision

Use GitHub-hosted Actions runners as isolated, short-lived preview/test environments. Each run checks out one immutable PR head SHA, installs the repository-pinned Node 24 toolchain, starts only the local services needed by its tests, and uses synthetic data in temporary directories/databases. The runner is discarded after the job.

This gives the project repeatable backend, frontend, full-stack, and migration verification without a long-lived server, a developer PC, a paid sandbox, or deployment changes. It is a CI preview/test environment, not a public live-preview URL. Screenshots or a browsable live URL require a separate, explicitly authorized preview-hosting decision.

## Four execution profiles

| Profile | Backend revision | Frontend revision | Required verification |
|---|---|---|---|
| Backend-only | PR head SHA | PR base SHA, provided frontend paths are unchanged | Backend baseline, HTTP/API, tenant isolation and persistence |
| Frontend-only | PR base SHA, provided backend paths are unchanged | PR head SHA | Browser module serving, onboarding/browser journey, UI contracts and offering templates |
| Full-stack | PR head SHA | PR head SHA | Backend + frontend + integrated browser/API journeys |
| Migration | PR head SHA | PR base SHA when frontend paths are unchanged | Fresh synthetic database, legacy-shape upgrade, idempotent replay, integrity and compatibility |

The runner checks out the PR head as one tree. For backend-only and frontend-only profiles, the unchanged side is content-identical to the base revision; the classifier must verify that before assigning the profile. If shared contracts or both component areas change, use full-stack. Migration takes precedence when a migration branch or migration/store schema path is detected.

A component SHA in the report is evidence of the exact revision selected for that component. Never infer a component revision from a branch name alone.

## Component boundaries

- Backend-owned implementation: `backend/**`.
- Frontend-owned implementation: `app/**`.
- The app contains modules imported by the backend (including platform contracts and browser/shared-module registries). Changes to these shared contract modules must be treated as full-stack, not frontend-only.
- Migration-sensitive changes include migration-named files, SQLite store/schema implementation, and branches explicitly named with the `migration/` prefix.
- Test and documentation changes do not by themselves turn a backend-only or frontend-only implementation into a full-stack change; the implementation paths determine the profile.

When classification is ambiguous, choose full-stack. Never silently compose incompatible frontend/backend revisions.

## Synthetic database and isolation rules

1. Every job uses a new GitHub-hosted runner and a unique temporary directory.
2. Set `NODE_ENV=test`, `SELLIFY_DATA_DIR`, and `SELLIFY_BACKUP_DIR` to job-local temporary paths. Let each regression own `SELLIFY_DB_PATH` when it explicitly provisions a database; do not globally override test-specific database paths.
3. Never connect to production, staging, or a user-owned database.
4. Never use real Telegram credentials, payment credentials, provider secrets, customer data, or production API endpoints.
5. Migration tests must cover a fresh database and supported legacy schema shapes, then verify replay/idempotency and foreign-key/integrity constraints.
6. A test failure must fail the workflow; do not convert failed assertions into warnings or skip the failing profile.

Existing migration regressions already demonstrate the intended pattern: they create temporary SQLite databases and remove them in `finally` cleanup. Reuse those tests rather than inventing a second migration authority.

## Business-template coverage

The current offering-template regression covers these nine registered business templates for both product and service suggestions:

- retail-shop
- barbershop
- hotel-rooms
- rental
- consultation
- repair
- restaurant
- wholesale
- other

The business-template persistence regression checks canonical persistence, audit atomicity, tenant binding and schema-version rejection. These are useful contract tests, but they do not yet prove a complete browser journey for every business template. Do not report them as full UI coverage.

Next expansion: a template-driven browser fixture should provision a synthetic tenant for each template, exercise onboarding, first offering, catalog, checkout and order views where applicable, and verify the resulting canonical backend state. Service templates must remain contract-only unless a real service booking flow is explicitly exercised; they must not be represented as inventory consumption.

## PR lifecycle and cleanup

- On PR opened, reopened or synchronized: classify, run the selected profile, and upload a short-lived evidence artifact containing the exact component SHAs, profile, test output and result. Frontend and full-stack profiles also capture a synthetic 390 × 844 first-experience browser screenshot.
- On PR closed: delete artifacts whose names are scoped to that PR.
- Use a concurrency group per PR and cancel superseded runs, so a new push does not leave obsolete work running.
- No runner, server, database or test fixture persists after a job. Artifact retention is short (three days); PR-close cleanup removes the PR's artifacts earlier.
- Do not create GitHub deployments, environments, Pages sites, DNS records, tunnels, or external preview services in this workflow.

## Repository toolchain

Use the existing `.nvmrc`, root `package-lock.json`, and `.github/actions/setup-sellify` composite action. Do not add a second Node/npm installer or repeat dependency setup in each workflow. Playwright installation is enabled only for browser profiles.

The existing setup action pins Node 24 and installs the root lockfile. The app package declares a separate `serve` development dependency but has no app lockfile; workflows should use the existing root browser/server harnesses rather than assume that root `npm ci` installs app-only dependencies.

## Rollout boundaries

1. Verify all four CI-only profiles on a feature-branch push; use `workflow_dispatch` for an individual profile when available.
2. Confirm the profile classifier against backend-only, frontend-only, full-stack and migration sample diffs.
3. Confirm synthetic DB isolation and artifact cleanup.
4. Only after review and explicit approval, merge the workflow to the default branch so it can govern all PRs. A workflow existing only on a feature branch cannot govern PR events whose base branch is `main`.
5. Add full browser journeys for all nine business templates as a separate test expansion.

## Success criteria

- Each profile reports backend and frontend SHAs explicitly.
- Backend-only and frontend-only profiles prove the opposite component is unchanged from base.
- Migration profile starts from a fresh synthetic database and tests legacy upgrade/replay.
- Full-stack profile runs integrated API and browser checks.
- Template coverage is accurately reported as contract coverage until browser journeys exist.
- PR close removes that PR's preview artifacts; ephemeral runner state is already discarded.
- No production data, secrets, deployments or persistent preview infrastructure are involved.
