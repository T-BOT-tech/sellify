# Sellify Phase 0 — Baseline Lock

**Source:** `sellify_phase6_seller_order_ops.zip`
**Purpose:** Freeze and characterize the working Phase 6 system before architectural upgrades.
**Rule:** Phase 0 introduces control artifacts and verification only. No domain rewrite is authorized by this baseline.

## Baseline identity

- Project: Sellify
- Source package: `sellify_phase6_seller_order_ops.zip`
- Source SHA-256: `17a4d3cc1efd47c40e7b24d60ada88a107ff0a2280ad8567349c7eff108cd1f8`
- Extracted file count: 105
- JavaScript syntax check: PASS
- Git metadata inside source package: NOT PRESENT
- Declared Node runtime: `>=24`
- Environment Node runtime observed during baseline execution: `v22.16.0`
- Backend smoke test (`/health`): PASS under observed runtime
- Static root smoke test (`/`): PASS under observed runtime

## Deployment shape

The Phase 6 source is a two-part application deployed as one unit:

```text
Sellify
├── app/       offline-first static PWA
├── backend/   multi-tenant sync backend
├── package.json
└── .env.example
```

The backend uses Node's built-in `node:sqlite` and is documented as requiring Node 24+.

## Existing persistence

### Browser

- IndexedDB is the primary browser persistence mechanism.
- localStorage is retained as fallback/legacy migration storage.
- `state.js` is the shared application-state singleton.

### Server

- SQLite is the server persistence layer.
- Schema migration versions observed: 1 through 5.
- SQLite WAL mode is enabled.
- Legacy JSON import remains as a one-time migration source.
- Backup support exists.

## Existing server schema domains

Observed in `backend/lib/store-sqlite.js`:

- tenants
- catalog_products
- orders
- phone_routing
- audit_events
- users
- memberships
- devices
- sessions
- auth_challenges
- pairing_challenges
- invites
- schema_migrations
- metadata

## Existing API surface

Observed route groups:

- `/health`
- `/config.js`
- `/auth/*`
- `/sync/:chatId`
- `/orders/:chatId`
- `/catalog/:chatId`
- `/tenants*`
- `/admin/backup`
- `/api/marketplace/*`
- static storefront `/store/:id`
- tracking `/track`

## Existing client domains

The source contains dedicated modules for:

- auth
- products
- orders
- marketplace
- B2B
- warehouse
- logistics
- restaurant
- sync
- storage/offline persistence
- platform adapters
- configuration/currency/locales/payment methods
- UI/theme/branding

## Baseline integrity observations

### Strengths to preserve

1. Offline-first browser storage already exists.
2. Server-side SQLite migrations already exist.
3. Marketplace checkout and seller-order operations are transaction-oriented.
4. Tenant-scoped authentication/session infrastructure exists.
5. Role/permission checks exist in client mutation paths.
6. Money is represented as integer minor units in the documented Phase 4 design.
7. Backup and audit infrastructure already exist.
8. Platform integration is already behind adapters.

### Phase 0 risks / discrepancies

1. **Runtime mismatch:** project declares Node >=24 while the current inspection environment is Node 22.16.0. Do not lower the project requirement merely to fit the inspection environment.
2. **No Git metadata in the source ZIP:** branch/tag/commit provenance must be established externally before production merge.
3. **Documentation drift:** some comments/documentation refer to older paths such as `backend/lib/store.js`; the actual Phase 6 source contains `backend/lib/store-sqlite.js`. This should be corrected as documentation debt, not treated as evidence that the runtime implementation is missing.
4. **Phase 6 already contains identity/auth concepts (`users`, `memberships`, `devices`, `sessions`). Phase 10.1 must extend and canonicalize these rather than create a parallel identity system.
5. **Phase 6 already contains audit events. Phase 10.7 must normalize/extend the existing audit trail rather than replace it blindly.

## Phase 0 exit criteria

- [x] Source archive identified.
- [x] Source archive extracted.
- [x] Full file inventory captured.
- [x] JavaScript syntax baseline passes.
- [x] Backend health endpoint smoke-tested.
- [x] Static application smoke-tested.
- [x] Existing schema migration chain identified.
- [x] Existing API route surface identified.
- [x] Existing module/domain surface identified.
- [ ] Node 24+ execution environment verified.
- [ ] Git repository provenance/tag established.
- [x] Golden regression suite implemented and green in the available environment; supported Node runtime gate remains required.
- [x] Automated backup/restore integrity drill completed against an isolated SQLite snapshot.
- [ ] Production backup/restore drill completed against the deployment/runtime environment.

**Status: PHASE 0.3 COMPLETE IN CODE — baseline, golden regression, migration idempotency, and automated backup/restore integrity controls are implemented. Production runtime/tagging remains gated on Node 24+ and repository provenance.**
