# PHASE 19.4 IMPLEMENTATION HANDOFF

## Scope
Seller & Organization Discovery.

## Status
IMPLEMENTED.

## Authority boundary
The provider discovers canonical `organizations` only where the organization has public Marketplace presence through at least one currently discoverable Marketplace listing. Organization identity remains authoritative in `organizations`; Marketplace remains authoritative for listing/transaction state.

## Implementation
- `backend/lib/discovery/marketplace-organization-provider.js`
- `backend/lib/discovery/index.js`
- `backend/server.js`
- `phase0/phase19.4-seller-organization-discovery-regression.mjs`
- `package.json` test scripts

## API
`GET /api/discovery/organizations`

Supported filters:
- `q` / `search`
- `country` / `countryCode`
- `currency`
- `seller`

## Safety properties
- Read-only discovery projection.
- No new migration.
- No duplicate organization identity.
- No supplier identity creation.
- No inventory mutation.
- No payment mutation.
- No order mutation.
- No ranking or AI behavior introduced.
- Organizations without discoverable Marketplace presence are excluded from seller discovery.

## Evidence
- Phase 19.3 regression: PASS.
- Phase 19.4 regression: PASS.
- Phase 18.12 cumulative exit: PASS.
- Runtime: Node v22.16.0.
- Node >=24 certification remains deferred to Phase 16.13.
