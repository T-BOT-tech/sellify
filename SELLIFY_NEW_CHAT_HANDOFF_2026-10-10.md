# Sellify New Chat Handoff — 2026-10-10

## Purpose

Resume Sellify implementation in a new ChatGPT conversation without losing current repository evidence, architectural constraints, open work, or the product direction. This document records a point-in-time handoff; re-check GitHub before making decisions because branches and CI can change.

## Repository and active work

- Repository: [T-BOT-tech/sellify](https://github.com/T-BOT-tech/sellify)
- Active feature branch: `ux/ecosystem-add-action-menu`
- Pull request: [#40 — feat(ux): introduce ecosystem Add action menu](https://github.com/T-BOT-tech/sellify/pull/40)
- PR status at handoff preparation: open, draft, unmerged.
- Diagnostic commit previously added: `21173747fe3b4d791d63586c0a635b1194cac950` — adds stack/error output to Phase 0 Golden Regression failure reporting.
- PR head observed during the latest check: `e1db4c1fffb10fb6a2560f92c2b473ff98ffad9b`. Verify current head before acting.

**Do not merge or close PR #40 without explicit user authorization.**

## Current Add (+) menu scope

The feature is navigation/composition only and should reuse existing domain flows:

- Take Order → existing order tab.
- Add Product or Service → existing catalog form.
- Discover Marketplace → existing marketplace tab.
- Configure Packs and Channels → existing settings/readiness/channel surfaces.
- Business Setup → existing settings surface.
- Queue remains available through the More menu.
- No “Become a seller” action is exposed until a canonical seller-onboarding flow has been verified.

Relevant files changed on the feature branch include:

- `app/index.html`
- `app/src/main.js`
- `app/src/window-bridge.js`
- `app/src/ui/add-menu.js`
- `app/src/ui/tabs.js`
- `phase0/ecosystem-add-menu-regression.mjs`
- `.github/workflows/ci.yml`
- `phase0/golden-regression.mjs` (diagnostic output only)

The focused Add-menu regression passed in the latest checked CI run. Syntax and separate security/logistics jobs also passed in the checked runs. Recheck current workflow runs before relying on these statuses.

## Newly confirmed baseline failure

The latest checked Phase 0 job log now exposes the underlying exception:

```
Phase 0 Golden Regression: FAILED
Regression error: Error: no such table: payment_evidence
    at runMigrations (backend/lib/store-sqlite.js:2007:10)
    at ensureDatabase (backend/lib/store-sqlite.js:5216:3)
    at Module.getOrCreateUserByTelegram (backend/lib/store-sqlite.js:9447:3)
    at phase0/golden-regression.mjs:50:28
```

The failure happens during early database initialization, before the Golden Regression test suite proceeds. The evidence points to a migration/schema dependency or ordering problem involving `payment_evidence`; **the exact migration responsible has not yet been identified**.

Latest checked workflow run: [38057857623](https://github.com/T-BOT-tech/sellify/actions/runs/38057857623). The failed baseline job was `114229905421`. This is the pull-request merge-ref CI run; verify newer runs first.

### Required investigation

1. Fetch the current PR head and latest CI run/jobs.
2. Inspect `backend/lib/store-sqlite.js` around migration execution line ~2007 and initialization line ~5216.
3. Find every migration that creates or references `payment_evidence`; determine which migration references it before creation or assumes a schema state not yet established.
4. Compare the current feature branch with `main` to determine whether the defect is pre-existing or introduced by this branch.
5. Reproduce using the supported Node runtime and an isolated temporary database if possible.
6. Fix the underlying migration dependency/order or incorrect schema assumption without skipping migrations, weakening assertions, or editing persisted production data.
7. Re-run the Phase 0 baseline, Add-menu regression, and relevant payment/migration regressions. Record actual outcomes and commit SHA.

Do not call the baseline healthy until it passes. A passing focused Add-menu regression does not replace the baseline gate.

## Architecture boundaries — preserve

`Frontend Intent/UI → Canonical Application Contract → Backend Authority → Authorization/Scope → State Transition → Audit/Event/Outbox`

- UI state is not authoritative business or financial state.
- Frontend permissions are not a security boundary.
- Provider adapters are not payment authorities.
- Reuse canonical backend contracts and existing domain flows; avoid duplicate registries or competing authorities.
- Preserve working functionality. Do not rewrite a subsystem merely to support the new navigation.
- Financial state changes must retain server-side authorization, idempotency, invariants, and auditable lineage.
- Regression gates must remain meaningful; do not bypass or weaken them to obtain a green build.

## Product direction: Commerce OS first experience

Sellify should help a merchant start selling quickly and progressively discover more capabilities. Keep these workflows distinct even when they are reachable from one entry surface:

1. Take an order.
2. Create the merchant's own product or service.
3. Discover/buy marketplace products or services.
4. Activate/configure vertical packs and capabilities.
5. Connect sales channels.
6. Complete seller onboarding where a verified canonical flow exists.
7. Configure business context and readiness.

Optional staff/printer setup should not block a basic “ready to sell” journey unless a specific business capability truly requires it. Marketplace discovery must not be confused with listing the merchant's own products or registering as a seller.

## Wider project context to preserve

- User's current focus includes the first-time merchant experience and ecosystem entry, but Sellify implementation must continue from actual live repository state.
- Payment Core hardening previously tracked GAP-1.18 onward, including evidence → verification → decision → payment transition lineage, persistence, idempotency, immutability, recovery, security boundaries, and production-readiness gates. Do not claim those are newly revalidated by this handoff.
- Logistics scheduling boundary L11.8 is designed so FEASIBLE can proceed to SCHEDULE, while CONFLICT/UNKNOWN blocks; scheduling must not itself reserve capacity, select a provider, dispatch, or mutate execution state.
- Dynamic capacity utilization was discussed as a future/additional feature, with flexible allocations rather than making the core verticals depend on rigid fixed-hour schedules.

## Recommended continuation sequence

1. **Refresh state:** inspect current PR #40, branch head, latest workflow runs, and repository files.
2. **Diagnose the baseline:** resolve the `payment_evidence` initialization/migration failure based on code and migration evidence.
3. **Revalidate UX:** verify Add-menu behavior and integrations with existing catalog, marketplace, settings, pack, and channel workflows.
4. **Update status:** distinguish implemented, tested, partially verified, blocked, and deferred items.
5. **Continue implementation:** take the next approved task only after the current regression state is clear.

## Working rules for the next chat

- Read existing handoff/roadmap/gap documentation before implementation.
- Inspect code and tests before editing.
- Treat live repository code and CI as evidence; roadmap documents describe intent, not proof of implementation.
- Never claim a test passed unless its actual output or CI result confirms it.
- Do not merge/close PRs without explicit user authorization.
- Report files changed, commit IDs, test outcomes, unresolved risks, and the next concrete action.
