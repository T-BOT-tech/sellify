# Phase 15.17 — Country Security / Isolation Expansion

## Scope
Expand country security/isolation policy without creating a country authorization authority.

## Canonical authorities
- Tenant scope: `backend/lib/tenant-isolation.js`
- Authorization: `backend/lib/authorization.js`
- Country scope: `backend/lib/country-security-isolation.js`
- Organization country: existing `organization.country`

## Activation model
- ET, KE, TZ, NG: active country packs; country security enforcement may execute.
- GH, ZM: strategic candidates; fail closed until an explicit country-pack activation.
- Other EAC/WAEMU/CEMAC members: regional-country-boundary-only metadata; fail closed until a country overlay exists.
- Unknown country: fail closed.

## Forbidden
No country permission store, membership store, session store, identity store, tenant store, organization store, location store, audit store, or event authority.

## Security rule
Country scope is subordinate to canonical tenant/location scope and canonical role authorization. A matching country never grants a permission that the existing authorization layer denies.

## External context
EAC is actively developing harmonised cross-border data-flow and cybersecurity/data-protection frameworks, while national regimes remain relevant. Therefore Sellify keeps regional security as contextual policy signals and requires country overlays rather than inventing a regional security authority.

## Status
Implementation status: boundary_only.
Node >=24 certification remains a separate pending release gate.
