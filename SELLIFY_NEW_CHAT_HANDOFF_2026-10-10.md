# Sellify New Chat Handoff — 2026-10-10

## Purpose

Resume Sellify implementation in a new ChatGPT conversation without losing current repository evidence, architectural constraints, open work, or the product direction. This document records a point-in-time handoff; re-check GitHub before making decisions because branches and CI can change.

## Repository and active work

- Repository: [T-BOT-tech/sellify](https://github.com/T-BOT-tech/sellify)
- Active feature branch: `ux/ecosystem-add-action-menu`
- Pull request: [#40 — feat(ux): introduce ecosystem Add action menu](https://github.com/T-BOT-tech/sellify/pull/40)
- PR status at handoff preparation: open, draft, unmerged.
- Diagnostic commit previously added: `21173747fe3b4d791d63586c0a635b1194cac950` — adds stack/error output to Phase 0 Golden Regression failure reporting.
- Current candidate head at this handoff refresh: `7ec2c68ad04c8f1bf3a0f601a313dc1058d3f771`. Re-check GitHub before acting.

**Do not merge or close PR #40 without explicit user authorization.**

## Current Add (+) menu scope

The feature is navigation/composition only and should reuse existing domain flows:

- Take Order → existing order tab.
- Add Product → existing catalog form. First-class service creation is deferred: the current catalog is product-shaped, and service-specific inventory/fulfillment semantics have not been established.
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

## Current verified baseline and payment certification

The previously reported Golden Regression failure involving `payment_evidence` and migration ordering is no longer the current blocker. The candidate branch now passes the full required CI workflow and repository security checks.

- Latest candidate head: `7ec2c68ad04c8f1bf3a0f601a313dc1058d3f771`
- Sellify CI: run 1395 — passed.
- Repository Security Checks: run 1395 — passed.
- PR #40 remains open, draft, and unmerged. These results apply to the candidate branch, not `main`.

### Payment Core / frontend certification completed on candidate branch

The latest PF-1L regression, `phase0/gap-pf-1L-payment-frontend-http-sqlite-e2e-regression.mjs`, runs the real frontend client through the actual HTTP route, provider adapter, Payment Core, and isolated SQLite persistence.

It verifies:

1. An unavailable provider result remains UNKNOWN and does not mutate the payment or ledger.
2. A successful provider observation validates amount, currency, receiver account, reference, transaction ID, and observation time before Payment Core commits MATCH → VERIFIED.
3. A lost HTTP response followed by the same-key retry replays the persisted result without repeating provider work or duplicating evidence, verification, decision, or ledger entries.
4. A transient provider network failure can be retried with the same key when the failure is known to have occurred before evidence persistence; the later successful result commits once.
5. A session from one tenant cannot query another tenant's payment or claim its status-query command.

The route-level test exposed and fixed:
- Missing durable status-query and recovery lookup methods in the HTTP server's Payment Core store adapter.
- Provider adapters not exposing observation fields in the shape Payment Core needs to validate.
- Decision logic that could interpret missing fields on an UNKNOWN observation as a financial mismatch.
- Same-key retry semantics for known-safe, retryable provider network/timeout failures.

The current implementation reuses migration 64 and the existing command table; no additional migration was needed for retryable failure metadata.

### Key recent commits

- `d8057ade394049e89b165e339365e865107c5ef4` — preserve provider observation fields for Payment Core validation.
- `53d4271ae51a7df4522e4ce711b7aa7dc326e316` — normalize verified provider observations through the status-query boundary.
- `87c9e28252c2ecd8adde9b660d89e2f49aca4c2c` — prevent UNKNOWN observations with missing fields from causing financial mismatch decisions.
- `df3d552f95b241026884a87172aefb7ba457788a` — safely reclaim same-key commands after retryable provider transport failures.
- `1e46659e1de82685b5b2baae2e9bd46eefb03e0a` — persist retryability metadata for safe provider failures.
- `c9f0f84b26e555379fb29b2cc5de15e05e8278ff` — certify successful route-level transition and same-key provider-error recovery.
- `7ec2c68ad04c8f1bf3a0f601a313dc1058d3f771` — update the authoritative gap analysis with current evidence.

**Interpretation:** Phases 1–3 are hardened and regression-certified on the candidate branch for the critical retry, recovery, successful-transition, unresolved-outcome, duplicate-effect, and tenant-isolation paths. This is not a claim that the same changes are on `main`; PR #40 has not been merged.

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
2. Create the merchant's own product. First-class service creation follows only after a canonical service type and compatible inventory/fulfillment behavior are implemented.
3. Discover/buy marketplace products or services.
4. Activate/configure vertical packs and capabilities.
5. Connect sales channels.
6. Complete seller onboarding where a verified canonical flow exists.
7. Configure business context and readiness.

Optional staff/printer setup should not block a basic “ready to sell” journey unless a specific business capability truly requires it. Marketplace discovery must not be confused with listing the merchant's own products or registering as a seller.

## Wider project context to preserve

- User's current focus includes the first-time merchant experience and ecosystem entry, but Sellify implementation must continue from actual live repository state.
- Payment Core hardening tracked GAP-1.18 onward, including evidence → verification → decision → payment transition lineage, persistence, idempotency, immutability, recovery, security boundaries, and production-readiness gates. These regressions passed on candidate CI run 1395; main still requires separate verification after an authorized merge.
- Logistics scheduling boundary L11.8 is designed so FEASIBLE can proceed to SCHEDULE, while CONFLICT/UNKNOWN blocks; scheduling must not itself reserve capacity, select a provider, dispatch, or mutate execution state.
- Dynamic capacity utilization was discussed as a future/additional feature, with flexible allocations rather than making the core verticals depend on rigid fixed-hour schedules.

## Recommended continuation sequence

1. **Refresh state:** inspect current PR #40, branch head, latest workflow runs, and repository files.
2. **Preserve payment baseline:** do not reopen completed payment work without new evidence; the current candidate passes CI and security checks.
3. **Review the Add-menu / first-experience scope:** verify the existing navigation against the agreed merchant journeys and ensure every action reaches a canonical existing surface.
4. **Define the service catalog contract:** inspect order, inventory, and fulfillment boundaries before adding a service type; do not treat an untracked product as a fully supported service.
5. **Choose the smallest next UX slice:** prefer one journey at a time, reusing existing backend authority and tests.
6. **Update the authoritative gap document** only when new implementation or regression evidence changes a status.
7. **Do not merge or close PR #40** without explicit user authorization.

## Working rules for the next chat

- Read existing handoff/roadmap/gap documentation before implementation.
- Inspect code and tests before editing.
- Treat live repository code and CI as evidence; roadmap documents describe intent, not proof of implementation.
- Never claim a test passed unless its actual output or CI result confirms it.
- Do not merge/close PRs without explicit user authorization.
- Report files changed, commit IDs, test outcomes, unresolved risks, and the next concrete action.
