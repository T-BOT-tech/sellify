# Sellify first-experience disposable integration candidate

- Worktree: `/home/ubuntu/parallel-next/first-experience-integration`
- Base HEAD: `7e49c3efbf705f32354d78a3fa62cb8b67604002`
- Final branch HEAD (no integration commit): `7e49c3efbf705f32354d78a3fa62cb8b67604002`
- Push/merge: none

## Live PRs and dependency order

| PR | base | head | dependency/decision |
|---:|---|---|---|
| 84 | 17ba6d6262ed2805cc432a2cdf2d884a8e47c010 | efcf503016e84e3bed800ad5c32187758b163156 | applied first |
| 85 | 44a339399ea76ea8dbb076dd6dfb018148a31673 | 1771fb33e9c5747e7a426bd2fac5eccf932f36fa | applied after PR84 |
| 87 | 17ba6d6262ed2805cc432a2cdf2d884a8e47c010 | f467d71023c5880467ddf9e6db10c138ba334a91 | applied after catalog persistence |
| 89 | 17ba6d6262ed2805cc432a2cdf2d884a8e47c010 | cae982c98935671bf68441fde4491ec964131650 | applied; shared onboarding resolved |
| 90 | 17ba6d6262ed2805cc432a2cdf2d884a8e47c010 | 3bb08d404759a774ffcc4123fdf2a95c88c320ab | applied last |

## Acceptance matrix

| Area | Result | Evidence |
|---|---|---|
| Service catalog contract | PASS | `npm run test:service-catalog-contract` |
| Service catalog HTTP | PASS | `npm run test:service-catalog-http` |
| Service catalog frontend/sync | FAIL | conflicts with PR89 currency control; PR84 canonical first-experience guard rejects `onboardingCurrency` |
| Country/onboarding integrity | FAIL | missing PR89-required interface-language onboarding markup after deliberate HTML conflict resolution |
| Returning merchant | PASS | bootstrap fast path is present in integrated source; prior run was stale against pre-resolution source |
| First-experience readiness/add/channel/ecosystem | PASS | targeted scripts all passed |
| Browser-serving core/HTTP/production | PASS | three targeted scripts passed |
| Browser smoke | BLOCKED | `playwright` package is not installed in sandbox |

## Deliberate shared-file decisions

- PR84/85 template onboarding and tenant persistence remain the canonical onboarding authority.
- PR89 country activation uses the existing country-pack and country-security contracts plus `/auth/country-packs`; no second country authority was introduced.
- PR89 UI country selector helpers/backend validation were integrated, but the PR89 language selector markup was not carried into `app/index.html`.
- PR90 package scripts were merged without replacing the existing first-experience scripts.

## Exact integrated files (once each)

- `.github/workflows/ci.yml`
- `app/browser-backend-modules.mjs`
- `app/dev-server.mjs`
- `app/index.html`
- `app/src/auth/permissions.js`
- `app/src/auth/tenant.js`
- `app/src/authorization/pack-readiness.js`
- `app/src/b2b/credit-terms.js`
- `app/src/channels/storefront.js`
- `app/src/config/currency.js`
- `app/src/config/locale-defaults.js`
- `app/src/experience/ecosystem-discovery.js`
- `app/src/experience/workspace.js`
- `app/src/i18n/language-preference.js`
- `app/src/i18n/locales/am.js`
- `app/src/i18n/locales/ar.js`
- `app/src/i18n/locales/en.js`
- `app/src/i18n/locales/es.js`
- `app/src/i18n/locales/fr.js`
- `app/src/i18n/locales/ha.js`
- `app/src/i18n/locales/hi.js`
- `app/src/i18n/locales/om.js`
- `app/src/i18n/locales/pt.js`
- `app/src/i18n/locales/ru.js`
- `app/src/i18n/locales/so.js`
- `app/src/i18n/locales/sw.js`
- `app/src/i18n/locales/yo.js`
- `app/src/main.js`
- `app/src/platform/seller-channel-storefront-contract.js`
- `app/src/products/catalog.js`
- `app/src/state.js`
- `app/src/storage/json.js`
- `app/src/sync/catalog.js`
- `app/src/telegram-buyer-storefront.js`
- `app/src/telegram-storefront-contract.js`
- `app/src/ui/home.js`
- `app/src/ui/i18n.js`
- `app/src/ui/settings.js`
- `app/src/ui/tabs.js`
- `app/src/window-bridge.js`
- `app/styles.css`
- `backend/lib/country-pack-onboarding.js`
- `backend/lib/store-sqlite.js`
- `backend/server.js`
- `package.json`
- `phase0/browser-module-serving-browser-smoke.mjs`
- `phase0/browser-module-serving-http-regression.mjs`
- `phase0/browser-module-serving-production-http-regression.mjs`
- `phase0/browser-module-serving-regression.mjs`
- `phase0/country-pack-onboarding-integrity-regression.mjs`
- `phase0/first-experience-add-availability-regression.mjs`
- `phase0/first-experience-channel-compatibility-regression.mjs`
- `phase0/first-experience-ecosystem-discovery-regression.mjs`
- `phase0/first-experience-home-readiness-regression.mjs`
- `phase0/first-experience-pack-readiness-regression.mjs`
- `phase0/first-experience-returning-merchant-regression.mjs`
- `phase0/first-experience-service-catalog-frontend-sync-regression.mjs`
- `phase0/first-experience-service-catalog-http-regression.mjs`
- `phase0/first-experience-visitor-discovery-regression.mjs`
- `phase0/gap-2-production-readiness-regression.mjs`
- `phase0/tg1-telegram-storefront-regression.mjs`

## Concrete uncovered gaps

1. Add PR89 language selector markup (`onboardingLanguage`) to `app/index.html` while preserving PR84 first-experience currency/settings boundary.
2. Reconcile PR89 country currency UI with PR84 tests: do not make detailed currency selection part of first-experience onboarding; use country-pack defaults server-side and configure overrides in Business Settings.
3. Install/declare Playwright for the browser smoke regression in the CI/runtime used for acceptance.
