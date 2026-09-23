# Phase 14.10 — Country Security / Isolation

## Purpose

Ensure country context cannot bypass or weaken the existing tenant,
organization, location, or role-authorization boundaries.

## Canonical authorities

- Tenant / organization / location scope: `backend/lib/tenant-isolation.js`
- Role/resource authorization: `backend/lib/authorization.js`
- Organization country identity: existing `organizations.country`
- Country configuration: Phase 14.9 read-only projection

## Implementation

Added `backend/lib/country-security-isolation.js` as a policy composition
boundary. A country-scoped decision first requires the canonical tenant and
location scope to pass, then requires the requested country to match the
canonical organization country. Action authorization is delegated to the
existing `authorize()` policy.

## Explicit non-goals

- no country permission store
- no country membership store
- no country session authority
- no country role matrix
- no country authorization database/table
- no replacement for tenant isolation
- no replacement for central authorization
- no payment, tax, compliance, document, or event security store

## Fail-closed rules

- missing tenant scope => DENY
- foreign organization => DENY
- foreign location => DENY
- missing requested country => DENY
- missing organization country => DENY
- country mismatch => DENY
- matching country still requires the existing role/resource authorization

## Migration

None. This is an additive policy boundary and does not alter existing route or
persistence authorities.
