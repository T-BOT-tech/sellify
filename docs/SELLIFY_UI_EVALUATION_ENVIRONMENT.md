# Sellify — Browser-Based UI Evaluation Environment

**Purpose:** Evaluate the actual Sellify PWA and its real backend from desktop or Android without deploying to production.

This is a private development/evaluation environment. Use synthetic identities and data only. Do not enter real merchant/customer information, payment credentials, production secrets, or live provider credentials.

## 1. Environment contract

- Node.js 24 development container.
- The existing backend serves both the PWA and API from one origin.
- Forwarded application port: **8787**, private to the Codespace.
- The backend uses Node 24's built-in SQLite support; no separate database service or new persistence authority is introduced.
- No production deployment, public preview, or external provider activation is performed.

The devcontainer installs root dependencies with `npm install --ignore-scripts`. The backend's development command is the existing `npm run dev:backend`; it starts the real backend with its existing static PWA serving path.

## 2. Launch from GitHub / Android

1. Open `T-BOT-tech/sellify` in GitHub.
2. Select branch `chore/ui-evaluation-environment-mainline-20261119`.
3. Choose **Code → Codespaces → Create codespace on this branch**.
4. Wait for the container setup to finish.
5. In the Codespaces terminal, verify the runtime and branch:

```bash
node --version
git status --short --branch
```

The Node version must be 24.x. Start the real full-stack application:

```bash
npm run dev:backend
```

6. Open the forwarded **Sellify application preview** port (8787) from the Codespaces Ports panel. It is configured as private. If the browser does not open automatically, use the forwarded-port link.
7. Verify the backend health endpoint at `/health` and confirm the PWA loads from the same origin.

To evaluate the latest merged implementation, use the current `main` branch. Do not fetch/merge historical PR branches #213 or #214: #213 is already merged, and #214's unique changes were consolidated and merged through #276.

## 3. Focused automated checks

Run the connected first-experience, persistence, Pack Recovery, and Appointments regressions from the repository root:

```bash
npm run test:first-experience-tenant-isolation-http
npm run test:first-experience-onboarding-browser
npm run test:first-experience-returning-merchant
npm run test:p1-14
npm run test:service-bookings-appointments-navigation
node phase0/service-booking-operator-browser-regression.mjs
```

These exercise the existing HTTP/authentication, tenant isolation, SQLite persistence, IndexedDB restoration, Pack readiness, and appointment UI boundaries. They do not replace manual visual evaluation.

If the focused checks pass and the Codespace has sufficient time/resources, run the broader regression gate:

```bash
npm run phase0:test
```

Record the exact commit SHA and command output. Do not describe a focused test run as full repository certification.

## 4. Product evaluation sequence

Use a fresh test identity and synthetic business data. Start with a clean browser context.

### A. First merchant and tenant lifecycle

- Complete first-time onboarding.
- Select a business type/template.
- Create the first catalog item.
- Verify product versus service classification, price/currency display, and stock semantics.
- Complete the first checkout and inspect payment states.
- Reload the browser and verify that the active tenant, authenticated session, template, and catalog are restored.
- Where the existing flow supports multiple test memberships, exercise tenant A → B → A using Settings.
- After each switch and reload, verify the visible business context and canonical catalog remain tenant-scoped.

A browser-side projection is not proof of backend persistence. Check the corresponding canonical API response as well.

### B. Core merchant surfaces

Review the existing **Home, Workspace, Catalog, Checkout, Orders, Appointments, Logistics, and Settings** surfaces.

For each, check:
- The primary user goal and next action are obvious.
- Tenant and, where relevant, location context are visible and unambiguous.
- Empty, loading, error, offline, pending, unknown, and confirmed states are distinct.
- Labels, totals, statuses, and action availability match canonical server state.
- There are no dead ends, duplicate actions, confusing labels, clipped content, or unexpected navigation changes.
- UI visibility does not substitute for server-side authorization.

For Appointments, verify that the workspace is separate from Logistics delivery operations, and that booking actions use inline forms and accessible status feedback rather than blocking browser prompts.

For Pack Recovery, verify that readiness is read-only, async loading is visible, stale tenant data does not repaint after a switch, and failures remain UNKNOWN rather than appearing successful.

### C. Mobile and accessibility checks

Use responsive/device emulation at these reference sizes:
- **360 × 800**
- **390 × 844**
- **412 × 915**

Check horizontal overflow, safe-area spacing, reachable primary actions, modal sizing, readable text, tap-target spacing, sticky elements, keyboard focus/order, Enter/Escape behavior, and screen-reader status announcements where applicable.

These are browser viewport checks, not native Android-device certification.

### D. API, backend, and data boundaries

- Confirm the application and API are served from the same backend origin.
- Verify tenant-scoped requests use the server-issued session and cannot read or mutate another test tenant's data.
- Verify reload persistence against IndexedDB and canonical API/database state.
- Confirm pending or queued commands are not presented as completed server execution.
- Confirm no UI action bypasses canonical Payment, Inventory, Commerce, Fulfillment, Logistics, Service Booking, Pack lifecycle, or Authorization authorities.
- Do not enable external providers or perform real payment, delivery, or settlement actions.

## 5. Evidence and defect handling

For each reproducible issue, record the commit SHA, surface, journey step, viewport, expected behavior, observed behavior, and relevant screenshot/console/network/API evidence. Classify it as:
- **Blocker / High / Medium / Low**
- **Visual or usability**
- **Client-state or persistence**
- **API/backend/authorization**
- **Database or migration**
- **Integration or environment**

Fix only demonstrated defects in the existing implementation. Prefer the smallest connected change and a regression test. Do not create a parallel architecture or move canonical authority into the UI.

## 6. Completion criteria

The evaluation environment is ready for use only after:
1. Codespace creation succeeds with Node 24.
2. `npm run dev:backend` starts the real backend successfully.
3. The private forwarded port 8787 serves both the PWA and API.
4. The `/health` endpoint responds successfully.
5. The focused regressions pass on the inspected commit.
6. The first-merchant, reload, and supported tenant-switch journeys are manually exercised.
7. The named product surfaces are reviewed at the mobile viewports above.
8. Findings are recorded with reproducible evidence.

**Current limitation:** Repository configuration and instructions can be validated in CI/source review, but actual Codespace creation, forwarded-browser access, and manual visual evaluation require launching the Codespace. Until those steps are performed, the environment must remain marked **prepared, not runtime-verified**.
