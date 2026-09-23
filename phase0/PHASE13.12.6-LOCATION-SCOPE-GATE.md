# Phase 13.12.6 — Location Scope Gate

**Status:** COMPLETE — 2026-09-08

## Objective

Certify the organization → location boundary for Phase 13 vertical-pack
capabilities without creating a second location authority, changing Phase 10.3
policy, or pulling Phase 13.12.7 capability authorization into this phase.

## Canonical authorities preserved

- Location persistence/identity: existing `locations` table and existing
  organization-location CRUD in `backend/lib/store-sqlite.js`.
- Location organization ownership: existing `locations.organization_id`.
- Tenant/organization isolation: `backend/lib/tenant-isolation.js`.
- Authorization policy: `backend/lib/authorization.js`.
- Server enforcement boundary: `requireAuthorization()` in `backend/server.js`.
- Session identity: existing session/membership/device authority.

No new location table, location membership table, scope store, evaluator, or
permission authority is introduced.

## Certified location boundary

For a location-scoped request, the existing boundary requires:

```text
Authenticated session
  → tenant organization matches session organization
  → target location belongs to tenant organization
  → canonical Phase 10.3 authorization
  → capability
```

A foreign-organization location is denied before capability execution.

## Important scope limitation — deliberately preserved

The current session model exposes `session.locationId`, but that value is the
canonical/default location context selected from the organization's `DEFAULT`
location. The source does **not** contain a user-to-location membership or
assignment authority.

Therefore Phase 13.12.6 does **not** reinterpret `session.locationId` as a
hard per-user location ACL. Doing so would silently introduce a new policy and
could break valid multi-location organization operations.

The gate consequently certifies **organization-owned location scope**, not a
new user-to-location assignment policy.

If future requirements need user-level location assignment, that must be a
separately approved authority/migration rather than being invented here.

## Coverage

The gate checks all 42 Phase 13 resource/action registry entries across the six
existing Phase 10.3 roles and exercises:

- valid location belonging to the same organization;
- foreign-organization location;
- missing location organization identity;
- missing location object at the server boundary;
- organization mismatch through the canonical authorization function;
- existing server calls to `assertLocationScope()`;
- inventory location-scoped request paths;
- absence of a duplicate location membership/scope authority.

## Non-goals

This phase does not implement:

- new role permissions;
- vertical capability authorization;
- mutation enforcement;
- approval workflows;
- audit/event changes;
- pack configuration;
- location membership/assignment persistence;
- Phase 13.14 outbox/event behavior.

## Exit invariant

```text
No Phase 13 vertical capability may treat a location as valid merely because
it has a location ID. The target location must remain owned by the same
canonical organization boundary before capability authorization proceeds.
```
