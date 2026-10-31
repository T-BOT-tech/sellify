# Sellify — Next Implementation Plan and Architecture Direction

**Document date:** 2026-10-31  
**Purpose:** Execution-oriented continuation plan for the existing Sellify repository and product strategy. This is a living implementation guide, not a proposal to restart the architecture.  
**Primary principle:** **Preserve the value of existing work—not existing implementation at the expense of Sellify's intended architecture, flexibility, or future potential.**  
**Product framing:** Sellify is the **Commerce OS** built on a Platform Kernel and Capability Runtime. Future domain products may reuse those foundations; Sellify should not become a universal workflow engine or an all-purpose AI platform.

---

## 1. Executive direction

Sellify's next stage should increase the number of businesses, offerings, transaction models, countries, and channels it can serve while reusing the same canonical commerce capabilities and domain authorities.

The intended outcomes are:

1. Support more business types without requiring one bespoke application or data model per industry.
2. Support products, services, and mixed product/service catalogs through the existing catalog and the appropriate existing operational capabilities.
3. Make business templates, product/service templates, Packs, business models, niches, country packs, and channels distinct concepts that work together.
4. Make Pack discovery and readiness understandable without letting discovery UI activate capabilities, grant permissions, or claim operational readiness.
5. Expand country and channel coverage through reusable configuration and adapters, not cloned commerce systems.
6. Improve merchant onboarding and the journey from discovery to setup, catalog creation, first transaction, fulfillment/service completion, and repeat use.
7. Retain useful current functionality, tests, integrations, and business logic while refactoring or replacing constraints that create competing authorities, inflexible combinations, hidden coupling, or expensive future change.
8. Deliver evidence-backed implementation in small coherent batches, with regression coverage and truthful CI reporting.

The goal is not to preserve every file or abstraction. The goal is to preserve and compound the working value of the product.

## 2. Working rules for execution

These rules apply to every batch:

- **Inspect before changing:** read the live branch/PR, current source, existing handoff and roadmap documents, migrations, tests, and CI evidence. Treat remote repository state as authoritative over remembered snapshots.
- **Implement, don't endlessly re-plan:** use this plan to guide real changes. Combine tightly related investigation, implementation, regression coverage, and verification when practical.
- **No duplication:** search for existing canonical contracts, data stores, routes, adapters, and tests before adding anything new.
- **Refactor when evidence supports it:** existing work is not protected from necessary architectural change. If it duplicates authority, prevents valid combinations, makes country/channel extension expensive, or blocks commercial opportunities, correct or replace it.
- **Preserve compatibility deliberately:** identify current consumers and persisted data before changing a contract. Use explicit migrations or compatibility adapters when they provide real value; do not keep a harmful design indefinitely just to avoid a migration.
- **Keep authority server-side:** UI state, manifests, recommendations, local caches, and country-pack metadata cannot prove a transaction succeeded or grant access.
- **No speculative capability claims:** a declared adapter, Pack, country mapping, or navigation item is not evidence of operational readiness.
- **Test the boundary being changed:** add a regression for the bug or missing behavior, then run the narrow test and relevant wider suites.
- **Report evidence separately:** source review, static checks, local/runtime tests, broader regressions, and CI are distinct. Never report an unrun test as passed.
- **Keep PR scope clear:** do not overwrite commits, reset a branch, merge, or close a PR without explicit authorization. Keep unrelated changes isolated.
- **Optimize for payoff:** prioritize work that unlocks reusable capability, merchant activation, transaction completion, country expansion, channel reach, or reduced cost of future change.

## 3. Product and architecture model

### 3.1 Platform layering

Use the existing intended boundary:

**Platform Kernel → Capability Runtime → Sellify Commerce OS → future domain-specific products**

Within Sellify, preserve the operation boundary:

**UI → Capability Client/API → Canonical Backend Authority → Business Operation → Audit/Evidence**

The UI helps people discover and use the system; it is not the authority for orders, payments, inventory, tenant membership, locations, pricing, customer acceptance, booking, fulfillment, refunds, or delivery completion.

### 3.2 Distinct concepts; explicit relationships

These concepts should not be conflated or represented as duplicate systems:

- **Business template:** an onboarding/setup profile that suggests useful defaults for a type of business. It is guidance and configuration, not an operational engine.
- **Business identity/model:** how the business is presented or transacts, where applicable. It must not implicitly activate unrelated Packs.
- **Industry/activity or niche:** what the business does, such as grocery, electronics, tailoring, repair, rental, food service, or wholesale. This should influence relevant examples and catalog guidance without becoming a second business taxonomy authority.
- **Product/service template:** a reusable starter definition for catalog entries or groups of offerings—fields, categories, units, variants/modifiers, required information, and suggested workflow context. It should seed the existing canonical catalog, not create a second catalog.
- **Catalog item:** the actual product or service offered by a merchant, stored and managed through the existing catalog authority. Mixed catalogs should be valid where the operational model permits them.
- **Business model / transaction model:** how a merchant sells or delivers value (for example, direct retail, wholesale/B2B, appointment-based service, rental, restaurant orders, or marketplace selling). Do not confuse this with the industry label.
- **Pack:** a reusable capability/configuration bundle that composes existing core capabilities and, where implemented, domain-specific behavior. A Pack is not a new copy of commerce, inventory, payment, booking, or fulfillment.
- **Country pack:** country-specific defaults, local rules, validation, document/tax configuration, and provider compatibility. It is not proof that a provider is enabled or compliant.
- **Channel:** a way a user or customer accesses Sellify, such as Telegram, installable PWA/web, POS/hardware, marketplace, or future channels. Channels should call the same canonical operations rather than own parallel transaction lifecycles.
- **Workspace / organization / location:** the business and operational scopes already represented in the platform. Buyer and seller experiences should use explicit roles and scope, not fork the underlying commerce authority.

A template may recommend a Pack; a Pack may depend on core capabilities; a country pack may constrain available configuration; a channel may expose a capability. None of these relationships should silently activate permissions or establish readiness.

### 3.3 Reuse rule

**Build → Use → Learn → Prove → Extract → Reuse.**

Prove a capability in a real workflow, extract stable contracts, and reuse it across business types, countries, and channels. Do not generalize speculative abstractions before evidence shows they are useful.

## 4. Current implementation baseline and known work

Reconfirm all statuses from live GitHub before acting. The following are known context, not substitutes for fresh checks.

### 4.1 PR #190 — business identity versus Pack activation

PR: https://github.com/T-BOT-tech/sellify/pull/190  
Branch: `fix/business-template-pack-activation-boundary`

The work separates `businessModel: restaurant` from explicit Restaurant Pack activation via `restaurantEnabled`, aligns manifest guidance with activation flags, preserves existing configuration precedence, and clears stale business-template cache after a successful canonical read returns no template. Contextual catalog guidance and non-activating Pack recommendations are also present.

Latest known head: `7f4fcb931f79ef395b704ea42a90c47ff3d12e9b`. A strict boolean activation change and regressions reject string-valued flags. At the last observed poll, the baseline, Logistics L18, and Logistics exit-certification jobs were running; security source hygiene had passed but the security workflow had not yet been confirmed fully complete. **Refresh current CI before making any status claim.** PR remains open and must not be merged without explicit authorization.

This PR is a narrow correction, not the final business configuration architecture. Do not add unrelated broad refactors to it simply because they are part of the larger roadmap.

### 4.2 Other ongoing reliability and country-pack work

- **PR #184:** country-pack regression/CI gates and final-snapshot artifacts; prior context says baseline browser smoke and both country-pack gates were required before merge. Recheck current status and do not duplicate its work.
- **PR #95:** same-tab fallback serialization for offline outbox persistence; previously reported CI was still in progress. Recheck current head and checks.
- **PR #98:** Node 24 migration-abort and browser-runtime diagnostics; prior instructions were to reproduce from the exact remote head in an isolated worktree, fix only that branch, preserve commits, and not merge without authorization. Recheck live status.
- **PR #94:** Web Locks API serialization of outbox journal writes and IndexedDB commit markers; previously reported CI passed baseline, Logistics L18, and offline outbox journal regression. Confirm whether merged or superseded before touching adjacent logic.
- **Logistics work:** existing canonical assessment, acceptance, fulfillment, delivery-proof, inventory, and marketplace order flows must be verified and reused. Do not create a parallel fulfillment lifecycle.
- **Payment Core:** existing Payment Core and provider-certification contracts remain the base. Launch-readiness work should focus on existing manual payments and SMS-based verification where supported, not expanding provider count or creating another payment authority.

Before implementation, read the latest repository handoff, roadmap, gap analysis, PR state, changed files, head SHA, and workflow logs. Keep each in-flight PR's work isolated.

## 5. Workstream A — Business setup and template architecture

### Goal

Make setup flexible and useful across more businesses while keeping templates declarative, composable, and subordinate to canonical operations.

### Tasks

1. Inventory current business templates and their actual consumers. Known template keys include `retail-shop`, `barbershop`, `hotel-rooms`, `rental`, `consultation`, `repair`, `restaurant`, `wholesale`, and `other`.
2. Map each template to existing catalog guidance, business model, activity/niche, relevant capabilities, and setup requirements. Mark unsupported or unverified mappings explicitly.
3. Distinguish template defaults from saved business configuration and operational capability activation.
4. Ensure changing a template cannot silently enable a Pack, grant a role, claim payment readiness, or rewrite canonical catalog/transaction data.
5. Test tenant-scoped persistence, canonical read behavior, no-template behavior, offline recovery, pending-write retry, and tenant/session switching.
6. Decide from evidence whether the current template key/schema can scale to reusable composition. If the schema forces one industry to imply a fixed bundle of capabilities, refactor toward declarative recommendations/composition rather than adding special-case branches indefinitely.
7. Preserve older saved values with a clear compatibility path where useful; do not let stale cache override a successful canonical response.

### Acceptance criteria

- Template selection is a setup aid, not authority.
- A merchant can operate with no template or a custom configuration where current product capabilities allow it.
- A business can combine supported capabilities without needing a new template for every combination.
- Cross-tenant cache leakage and stale-response overwrites are regression-tested.
- Unsupported Pack mappings are not invented.

## 6. Workstream B — Product and service templates; mixed offerings

### Goal

Make it easier for merchants to create accurate catalogs for different activities while keeping one canonical product/service catalog.

### Tasks

1. Audit `app/src/products/catalog.js`, `app/src/config/niche.js`, catalog persistence/sync, service-booking contracts, and existing category/unit/modifier/tag behavior.
2. Define the smallest reusable **catalog template** contract that current code can actually support. Candidate data may include item type (product/service), suggested category, unit, common attributes, variants/modifiers, optional tags, and relevant next-step guidance. Keep required/optional semantics explicit.
3. Separate product templates from service templates where fields and workflows differ, while sharing the common catalog item contract. Examples may include repair service, consultation, appointment, room/rental offer, prepared food/menu item, wholesale goods, and standard retail products—but only seed templates when existing capabilities can support the proposed data.
4. Support mixed product/service catalogs where the current order/booking/fulfillment contracts permit them. If a real contract limitation blocks this, trace the canonical backend constraints and decide whether to extend or refactor them; do not hide the limitation in UI.
5. Keep templates as starter data. A template must not silently create stock, set operational availability, establish a booking, activate marketplace listing, or imply that a product/service is ready for sale.
6. Reuse existing money/currency, inventory, service-booking, order, and catalog authorities. Price handling must remain consistent with canonical minor-unit rules.
7. Add regressions for product-only, service-only, mixed catalog, edit/reload/sync, optional fields, and legacy catalog entries.

### Acceptance criteria

- One catalog authority remains.
- Template selection accelerates setup but does not create a second catalog or domain lifecycle.
- Mixed offerings are supported where domain contracts permit them, with explicit failures or a scoped backend change where they do not.
- Templates are extensible without copying an entire form or CRUD implementation for every industry.
- Suggestions are localizable and country-neutral unless a genuine country-specific rule applies.

## 7. Workstream C — Packs, capability composition, discovery, and readiness

### Goal

Enable merchants to discover and compose reusable capabilities while preventing identity/configuration metadata from masquerading as activation or readiness.

### Tasks

1. Audit `app/src/verticals/configuration.js`, `app/src/verticals/contract.js`, `shared/vertical-pack-manifests.js`, Pack-specific config contracts, lifecycle enforcement, permission checks, and existing tests.
2. Verify each Pack's declared capabilities, dependencies, permissions, domain entities, configuration flags, routes, and actual implemented workflows agree. Manifest declarations alone do not prove implementation.
3. Keep core-owned entities and authorities in Core. Packs bridge to commerce, inventory, payments, customers, locations, fulfillment, documents, audit, authorization, and events rather than recreate them.
4. Preserve strict activation semantics: identity and recommendations do not activate; only the authorized explicit configuration/activation flow may do so. Confirm server-side enforcement wherever activation affects protected operations.
5. Distinguish states such as available, recommended, configured, activation requested, active, blocked by requirements, and operationally verified only if the existing lifecycle can represent them accurately. Do not add a status model until auditing current lifecycle enforcement and consumers.
6. Improve discovery guidance to show why a Pack may help, its dependencies, requirements, limitations, and next step. Do not claim provider connection, permissions, compliance, or readiness based on a recommendation.
7. Agriculture is currently declarative-only; Restaurant, Warehouse, and Logistics have existing implementation paths. Do not market declarative-only Agriculture as an operational Pack without evidence and certification.
8. Expand recommendations only for verified existing Pack/capability matches. Where no direct match exists, give generic setup guidance rather than speculative Pack recommendations.
9. Consider refactoring the Pack contract if the current `niche_switch` string or scattered flags cannot represent a stable, validated activation contract. Inspect all consumers before changing schema; add a migration/compatibility path only when needed.

### Acceptance criteria

- A business identity cannot accidentally activate a Pack.
- String values cannot pass as boolean activation.
- Organization/location scope isolation and override precedence remain correct.
- No duplicate inventory, order, payment, customer, fulfillment, authorization, or audit authority is introduced.
- Discovery remains informational and accurately distinguishes declared, implemented, enabled, and verified capability.

## 8. Workstream D — Global Core and country-pack readiness

### Goal

Build globally reusable commerce behavior with country-specific localization and provider integrations added deliberately, country by country.

### Strategy

**Global Core first; country-ready architecture from the beginning; focused country launches and localization by commercial priority.** Do not make Sellify Ethiopia-only, but do not fully localize every country before launch proof.

Existing country-pack context includes Ethiopia, Kenya, Tanzania, and Nigeria. Reconfirm current contracts and actual readiness; mappings and config declarations are not operational proof.

### Tasks

1. Audit country-pack contracts for identity/locale, currency/money, tax, documents/invoices, phone/address, payment adapter compatibility, compliance, configuration, security/isolation, events/outbox, integrations, and cross-country regressions.
2. Keep country selection and interface language selection distinct. Existing localization supports country/language selection and 13 languages; do not build a second localization system.
3. Treat currency as canonical business/tenant configuration with correct minor-unit money handling. Use country defaults only as defaults; allow supported business-level configuration through existing settings. Never silently reinterpret persisted prices when currency changes.
4. Maintain explicit support levels per country and feature: available default, implemented, integrated, tested, production-ready, or deferred—using terms the repository can substantiate.
5. Keep country-specific validation and tax/document adaptations in country configuration/adapters. Core owns transactions and money invariants.
6. Payment launch priority: make existing Payment Core launch-ready for supported manual payments and SMS-based payment verification. Inspect provider registry, canonical payment contracts, country adapter mappings, idempotency, certification tests, and status-query semantics. An adapter mapping is not an activated or operational provider. Do not expand provider count as a substitute for readiness.
7. Preserve current Ethiopia work as a compatibility and launch-readiness baseline, not as a reason to hard-code Ethiopia assumptions into global Core. Kenya and other country work must not claim deferred integrations such as M-Pesa until verified.
8. Add or maintain cross-country tests for tenant isolation, money/currency invariants, invalid/unsupported country configurations, fail-closed behavior, provider activation, and country-specific regressions.
9. Prioritize the next country by merchant demand, feasible local payments/logistics, regulatory complexity, channel reach, and expected commercial return—not by completing a large country list for its own sake.

### Acceptance criteria

- Core business operations remain country-neutral wherever possible.
- Country packs localize and validate; they do not become alternative order/payment authorities.
- Unsupported features fail closed and are labelled honestly.
- Currency, language, country, payment provider, and compliance readiness remain distinct concepts.
- Cross-country regressions run in CI with durable artifacts where required.

## 9. Workstream E — Channel strategy and shared commerce journeys

### Goal

Increase reach through channels while keeping the same canonical operations and evidence.

### Existing/target channels

- Telegram bot and Telegram Web App / Mini App.
- Installable PWA and browser-based seller experience.
- POS and hardware integrations.
- Marketplace discovery and buyer/seller journeys.
- Future channels based on commercial evidence.

### Tasks

1. Map each channel to authentication, workspace/scope selection, catalog presentation, canonical API operations, offline behavior, and user-facing evidence.
2. Keep channel-specific presentation and interaction in channel adapters; do not duplicate payment, order, inventory, booking, or fulfillment state machines.
3. Treat Telegram adoption as an important distribution path, but reuse canonical identity/session and authorization contracts. Do not trust client-supplied Telegram identity without server validation.
4. Verify PWA/offline behavior against canonical backend reconciliation. Outbox journals and local caches aid recovery but are not canonical business truth.
5. Build a shared end-to-end merchant journey: discover Sellify → choose/create workspace → configure country/language → select or skip business template → create product/service catalog → configure supported payment options → publish or choose channel → receive canonical order/booking → fulfil/deliver/complete service → capture audit/evidence → reconcile and support repeat use.
6. Ensure marketplace buyer/seller flows reuse the existing canonical order/payment/settlement/fulfillment chain.
7. Use journey failures to prioritize fixes, including onboarding abandonment, first catalog item, first successful payment/verified manual payment, service completion, delivery proof, and offline recovery.

### Acceptance criteria

- The same business operation behaves consistently across supported channels.
- Channel-specific failure does not create a parallel domain authority.
- Offline actions reconcile through canonical commands with idempotency and auditability.
- Journey tests cover discovery through completion, not just isolated UI rendering.

## 10. Workstream F — Workspaces, business profiles, and reusable configurations

### Goal

Make the platform flexible for solo merchants, multi-location businesses, teams, B2B buyers/sellers, and future ecosystem participation without multiplying business backends.

### Tasks

1. Audit existing tenant, organization, location, membership, role, buyer/seller, and workspace contracts.
2. Define the user-facing workspace language using existing canonical scopes. Do not introduce a competing organization model.
3. Treat buyer and seller as roles/contexts over canonical commerce relationships where possible, not necessarily different application authorities.
4. Make a business profile composable from identity, activities, catalog offerings, supported transaction models, locations, channels, country configuration, and enabled capabilities—only where current contracts support these dimensions.
5. Keep packs such as warehouse, logistics, B2B, restaurant, marketplace, and other business contexts as reusable configurations/capability combinations, not independent product forks.
6. Separate current supported combinations from future candidates. Validate each combination through actual canonical journeys before declaring support.

### Acceptance criteria

- Multiple business types and locations do not leak cached configuration or authority across tenants.
- Profiles can express legitimate combinations without an explosion of template-specific code.
- Role and scope checks are enforced by existing backend authorization.

## 11. Workstream G — Reliability, offline operation, security, and CI

This work is foundational to commercialization and should progress alongside feature work where changes overlap.

### Tasks

1. Recheck PR #95 and #98 current heads and exact CI failures before touching their branches.
2. For outbox and IndexedDB changes, preserve atomicity/order guarantees across same-tab and multi-tab writes, Web Locks availability, browser restart, IndexedDB failure, migration abort, and second hydration.
3. Keep browser smoke tests exercising the real application entry path. Do not make tests pass by exposing backend source files through the production server or weakening source boundaries.
4. Address actual module-resolution/export/cycle issues revealed by smoke tests at the correct application boundary.
5. Verify Node 24 compatibility in CI; treat deprecation notices separately from actual failures, but keep workflows current with supported actions.
6. Preserve tenant/device/session isolation, authorization, idempotency, immutable delivery proof, auditability, and fail-closed behavior.
7. Avoid broad unrelated workflow changes while repairing a targeted reliability PR.

### Acceptance criteria

- Recovery tests cover real failure modes, not only happy paths.
- Baseline browser smoke and relevant Logistics/country-pack regressions pass on the tested head.
- Security/source-hygiene checks pass.
- CI evidence is tied to the exact head SHA being reported.

## 12. Workstream H — Logistics, services, and operational completion

### Goal

Support physical goods and service commerce using existing canonical lifecycles and shared catalog/order/payment authorities.

### Tasks

1. Reconfirm the current state of Logistics assessment/acceptance, service delivery, courier assignment, proof immutability, inventory effects, and marketplace fulfillment.
2. Preserve idempotent command replay and canonical command keys; verify conflicts fail explicitly rather than duplicating side effects.
3. Ensure service assessments and customer acceptance are canonical backend facts, not client claims.
4. Ensure inventory is affected only by the correct canonical fulfillment/sale event and that replay cannot double-decrement stock.
5. Reuse service booking and catalog contracts for appointment/consultation/repair/rental flows where they fit. Where they do not, identify the missing domain contract before expanding UI.
6. Continue the journey from marketplace discovery to seller order, fulfillment, payment/settlement, delivery or service completion, and evidence.
7. Do not create a second fulfillment lifecycle for Parcel Delivery or a generic transport authority.

### Acceptance criteria

- Assessment, acceptance, assignment, delivery, proof, inventory, payment, and settlement transitions remain server-authoritative and idempotent.
- Product delivery and service completion can coexist without being forced into the wrong lifecycle.
- End-to-end regressions prove the whole operation chain.

## 13. Prioritization and delivery sequence

The workstreams are coordinated; they should not become eight separate platforms or eight sequential planning exercises. Execute overlapping work in parallel where it is safe, while keeping code ownership and PR scope isolated.

### Immediate — current branch and live evidence

1. Refresh PR #190 status and CI; resolve any real failures on that branch.
2. Refresh PR #184, #95, #98, and #94 statuses to avoid duplicate work and identify blockers.
3. Read current handoff, roadmap, and gap analysis from the repository; reconcile them with this document.
4. Identify one concrete contract mismatch or missing journey behavior per implementation batch and add a regression with the fix.
5. Keep PR #190 focused on business-template/Pack activation boundary. Do not merge without explicit authorization.

### Next high-value implementation batch — reusable merchant setup

1. Map current business templates to actual supported catalog, service, and Pack capabilities.
2. Audit the product/service catalog and service-booking contract for real mixed-offering constraints.
3. Implement the smallest reusable product/service template layer that seeds the existing catalog and does not imply readiness.
4. Improve contextual setup and Pack discovery using only verified capability matches.
5. Add tests for template persistence, mixed catalogs, strict activation, country defaults, and tenant/session isolation.

### In parallel — unblock commercialization foundations

- Finish exact-head reliability and country-pack CI investigations.
- Verify payment readiness for supported manual/SMS-verification paths.
- Maintain Logistics/marketplace end-to-end integrity.
- Improve channel journey consistency, prioritizing Telegram and PWA where they provide measurable distribution value.

### After evidence from real journeys

- Expand verified Pack combinations.
- Prioritize the next country-pack by demand and operational readiness.
- Expand product/service template coverage from merchant use cases.
- Introduce new shared abstractions only when repeated implementations demonstrate that extraction will reduce cost or unlock reuse.

## 14. Test and evidence matrix

Every implementation batch should identify the relevant checks from this matrix:

| Evidence layer | What it proves | Reporting rule |
|---|---|---|
| Source/contract review | The proposed boundary agrees with current consumers and authorities | Report what was inspected; source review is not runtime proof |
| Static/lint/type checks | Syntax and supported static rules pass | Report exact command/workflow and result |
| Focused regression | The targeted bug/behavior is exercised | Name the test and actual output |
| Domain regression | Existing payment, catalog, country, service, Logistics, or Pack behavior remains correct | Report each relevant suite independently |
| Browser/runtime smoke | Real app entry, module loading, and critical journey work | Do not replace with source-serving workarounds |
| Security/source hygiene | Security-sensitive source boundaries and checks pass | Distinguish job completion from whole workflow completion |
| Full CI | All required workflows for the exact head pass | Include run IDs/head SHA; never infer from an earlier commit |
| Production readiness | Real provider/operation and required controls have been verified | A green unit suite or manifest declaration alone is insufficient |

Minimum regressions to preserve or add where applicable:
- business identity does not activate a Pack;
- invalid string flags do not activate a Pack;
- configuration precedence and organization/location scope isolation;
- tenant-scoped template cache, canonical empty result, offline retry, and late response safety;
- product/service/mixed catalog creation, persistence, edit and sync;
- country selection vs language selection and currency invariants;
- unsupported country/provider behavior fails closed;
- Pack discovery does not activate or grant permissions;
- canonical order/payment/inventory/fulfillment/service completion idempotency;
- offline outbox and IndexedDB recovery across browser failure modes;
- full-app browser smoke and security/source hygiene.

## 15. Non-goals and guardrails

Do not build these as separate competing systems:

- a universal workflow engine;
- a generic AI platform;
- a capability marketplace/registry that duplicates existing Pack contracts;
- a second order, payment, catalog, inventory, booking, or fulfillment authority;
- a parallel logistics/transport lifecycle;
- a second onboarding or country configuration system;
- per-country forks of the commerce core;
- a new template-specific CRUD system for every industry;
- automatic Pack activation or readiness claims based only on recommendations;
- speculative abstractions without an evidenced reuse case.

These exclusions do not prohibit useful architectural change. If a current component is effectively one of these duplications or prevents the intended product strategy, refactor or replace it with a deliberate migration and tests.

## 16. Decision framework: preserve, extend, refactor, or replace

For every significant existing design, evaluate:

1. Does it preserve canonical authority and tenant/scope security?
2. Can it express supported combinations of business type, offerings, country, and channel?
3. Does it allow capability reuse without copy/paste forks?
4. Does it create hidden coupling or require repetitive special cases?
5. Does it block a commercially valuable merchant journey or country/channel launch?
6. Can its contract be evolved compatibly, or is a migration justified?
7. Is there direct source/test/runtime evidence for the proposed change?

Then choose deliberately:

- **Preserve** when the implementation is sound and reusable.
- **Extend** when the contract is right but a capability is missing.
- **Refactor** when the boundary or coupling blocks flexibility or increases change cost.
- **Replace** when the design conflicts with the intended architecture or makes future work materially more expensive.

Do not use “backward compatibility” to preserve a harmful authority boundary indefinitely. Do not replace working code merely for stylistic preference. The deciding factors are evidence, business value, architecture, migration risk, and future leverage.

## 17. Definition of success

The plan is succeeding when:

- a new merchant can configure a legitimate business profile without being forced into one rigid industry template;
- product and service offerings can be combined where the canonical business flows support them;
- templates accelerate setup without becoming new authorities;
- reusable Packs compose existing capabilities and disclose their actual readiness;
- new countries require localized configuration and proven adapters, not cloned commerce systems;
- new channels reach the same canonical operations and evidence;
- reliability and security tests prove recovery and isolation;
- implementation batches reduce duplication and increase merchant outcomes;
- decisions are based on current repository evidence and verified results;
- existing work is preserved where it creates value and changed where it blocks Sellify's intended future.

**Final operating principle:** Maximize reusable business capability, distribution reach, country/channel flexibility, and commercial payoff—without multiplying the underlying systems.
