# Sellify UI Evaluation Environment

## Purpose

Provide a repeatable, browser-accessible preview of the real Sellify PWA and backend so the existing product can be evaluated on desktop and mobile-sized viewports. This environment is for development and evaluation only. It is not a production deployment and must not contain real merchant or customer data.

## Current baseline and scope

This environment branch starts from the verified `main` snapshot used when it was created. It does not merge or change PR #213 or PR #214, and it does not alter `main`, either PR, or their branches.

- PR #213 adds a real HTTP tenant-isolation regression.
- PR #214 adds browser reload persistence coverage and a Pack Recovery async readiness fix, despite its description saying no production changes; inspect its actual patch before integrating.
- Both PRs are open and have passed their exact-head Security and Sellify CI workflows. Their combined integration has not yet been tested.

The preview initially shows the branch's current application. The combined candidate should be created locally in Codespaces by integrating PR #213 and PR #214 without merging either PR to `main`.

## Launch from Android

1. Open the repository in GitHub and switch to branch `feat/ui-evaluation-environment`.
2. Open **Code → Codespaces → Create codespace on feat/ui-evaluation-environment**.
3. Wait for the environment to finish creating. The devcontainer provides Node.js 24 and installs root dependencies.
4. In the terminal, verify the environment:

```bash
node --version
git status --short --branch
```

5. Start the real full-stack app:

```bash
npm run dev:backend
```

The backend serves the PWA and API from the same origin on port 8787. Open the forwarded **Sellify application preview** port from the Codespaces Ports panel if it does not open automatically.

## Build the combined integration candidate (local only)

Do not merge PRs on GitHub. Keep this Codespace candidate local:

```bash
git switch -c preview/first-experience-integration
git fetch origin pull/213/head:refs/remotes/origin/pr-213
git fetch origin pull/214/head:refs/remotes/origin/pr-214
git merge --no-commit --no-ff origin/pr-213
```

If PR #213 merges cleanly, then integrate PR #214:

```bash
git merge --no-commit --no-ff origin/pr-214
```

If either merge reports conflicts, stop and inspect the exact conflict. Do not force a merge or discard changes. This is a disposable local integration candidate; do not commit or push it unless separately authorized.

After integration, run the focused regressions:

```bash
npm run test:first-experience-tenant-isolation-http
npm run test:first-experience-onboarding-browser
npm run test:p1-14
```

Then run the broader baseline only if the focused checks pass and the Codespace has sufficient time/resources:

```bash
npm run phase0:test
```

## Evaluation sequence

Use a fresh, clearly test-only merchant identity and synthetic data. Do not use real customer details, payment credentials, live provider accounts, or production secrets.

### 1. First merchant journey

- Start from a clean browser context.
- Complete first-time merchant onboarding.
- Select a business type/template and confirm the selected business context.
- Create the first catalog offering.
- Confirm product/service behavior is correct: services must not be treated as ordinary physical stock.
- Reach the first checkout and inspect payment states. A pending payment must never be presented as confirmed/paid.
- Confirm the resulting order is visible in the appropriate order experience.

### 2. Core product surfaces

Evaluate the existing Home, Workspace, Catalog, Checkout, and Order experiences. For each, record:
- What the user is trying to accomplish.
- Whether the next action is obvious.
- Whether business/location context is visible and unambiguous.
- Whether loading, empty, error, offline, pending, and success states are distinguishable.
- Whether labels and totals describe the actual canonical state.
- Any dead ends, duplicate actions, confusing terminology, clipping, or unnecessary steps.

Do not assume a surface or capability is present merely because it is in the evaluation list. Record unavailable or inaccessible surfaces as findings rather than inventing routes.

### 3. Tenant switching and reload

- Create/use two synthetic businesses under the supported test identity, where the existing app flow permits it.
- Switch A → B → A.
- Verify the active business context after each switch.
- Reload the browser after each switch.
- Verify that the selected business, catalog, session, and template remain correctly associated.
- Verify tenant A cannot read or mutate tenant B's protected data through the real HTTP boundary.

### 4. Mobile-sized evaluation

Use browser responsive/device emulation or the browser viewport controls at these reference sizes:
- 360 × 800
- 390 × 844
- 412 × 915

Check horizontal overflow, reachable primary actions, sticky elements, modal sizing, keyboard/form behavior, tap target spacing, readable text, and navigation. These are viewport checks, not a claim of native Android-device certification.

## Evidence and defect policy

For each issue, capture:
- Screen/surface and exact user journey step.
- Viewport size and browser context.
- Reproduction steps.
- Expected behavior vs observed behavior.
- Screenshot or browser-console/network evidence when available.
- Severity: blocker, high, medium, or low.
- Whether it is a visual/usability issue, a client-state issue, or a canonical backend/authority issue.

Fix only reproducible problems in the existing implementation. Prefer the smallest focused change and a regression test. Do not rebuild navigation, workspace, onboarding, catalog, checkout, orders, or business logic to solve a localized issue. Do not make UI state authoritative for orders, payments, inventory, tenant scope, fulfillment, service acceptance, refunds, or settlements.

## What counts as completion

The evaluation environment is operational only after:
1. Codespace creates successfully with Node 24.
2. The real backend starts and serves the PWA on forwarded port 8787.
3. The preview loads in the Android browser.
4. Focused combined regressions pass on the local integration candidate.
5. The first-merchant journey and A → B → A reload checks are manually exercised.
6. The five target product surfaces are reviewed at mobile-sized viewports.
7. Findings are recorded with reproducible evidence and any implemented fixes have focused regression coverage.

CI success for the individual PRs is not a substitute for combined integration or manual UI evaluation.
