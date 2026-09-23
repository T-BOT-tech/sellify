# Phase 10.3 — Central Authorization

Status: implemented additively.

## Contract

```text
authorize(actor, organization, location, resource, action)
  → ALLOW | DENY | REQUIRES_APPROVAL
```

The policy lives in `backend/lib/authorization.js`. Authentication and session
resolution remain in the existing `backend/lib/store-sqlite.js` and
`backend/server.js` flow.

## Roles

- owner
- manager
- cashier
- staff
- buyer
- viewer

Existing effective permissions are preserved first. `staff` is now a first-class
server role with location viewing permission, matching the role already accepted
by the Phase 10.2 location boundary. `viewer` is intentionally read-only at the
policy layer.

## Compatibility

- Existing `tenants`, `chat_id`, memberships, devices, sessions, and routes remain.
- `requireOwnerRole()` remains as a compatibility wrapper, but delegates to the
  central policy instead of owning role logic.
- Existing tenant/session boundaries remain enforced.
- Session authentication now exposes canonical `organizationId` and the default
  `locationId` so authorization can validate organization/location scope without
  introducing a second session model.
- No inventory, order, catalog, or sync data model is rewritten in this phase.

## Initial route migrations

The central policy is applied to:

- seller order viewing
- marketplace seller order status changes
- location viewing
- location creation
- location updates

Other legacy role gates continue through the compatibility wrapper and are
candidates for deliberate route-by-route migration after regression coverage.

## Security rule

Frontend permission checks are UX only. Server authorization is the security
boundary.

Denied authorization carries `AUTHORIZATION_DENIED` and is suitable for the
existing audit pipeline; no new parallel audit store is introduced.

## Validation

Run:

```text
node phase0/phase10.3-authorization-regression.mjs
```

and the existing Phase 0 golden regression under Node 24+ before release.
