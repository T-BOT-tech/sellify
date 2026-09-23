# Phase 13.11.14 — Authorization / Tenant Isolation

Status: COMPLETE.

## Scope

Phase 13.11.14 hardens the existing authorization/session boundary without
introducing another tenant, organization, location, membership, or session
store.

## Canonical authorities

- Sessions + memberships + devices remain authentication/session authority.
- `tenants.chat_id -> tenants.organization_id` remains tenant-to-organization
  identity authority.
- `organizations` remains organization authority.
- `locations.organization_id` remains location ownership authority.
- `backend/lib/authorization.js` remains role/permission policy authority.
- Frontend permissions remain UX only.

## Additive control

`backend/lib/tenant-isolation.js` provides policy-only checks for:

- authenticated session → requested tenant
- authenticated session → tenant organization
- requested location → tenant organization

The backend now applies the tenant-scope check after session authentication and
before central authorization. Inventory location query/create paths additionally
resolve the existing canonical location row before permitting location-scoped
access.

## Security invariants

1. A valid session for tenant A cannot operate against tenant B.
2. A session whose organization does not match the requested tenant is denied.
3. A location belonging to another organization is denied.
4. Central role/permission policy remains authoritative after scope validation.
5. Existing tenant, membership, session, organization, and location models are
   preserved.
6. No duplicate tenant/organization/location authority is introduced.
7. No new persistence or session model is introduced.

## Compatibility

The existing `requireTenantAuth`, `requireSession`, and `requireAuthorization`
flow remains in place. This phase adds explicit scope validation rather than
replacing those mechanisms.

## Validation

Run:

```text
npm run test:phase13.11.14
```

Then run the cumulative Phase 13.11 and historical gates under the project's
required Node >=24 release environment.

Current development environment remains Node 22.16.0, so Node 24 release
certification is not claimed by this phase.
