# Phase 14.8 — Ethiopia Compliance Boundary

## Status

COMPLETE — boundary-only implementation.

## Objective

Connect the Ethiopia country pack to the existing Core compliance/audit
capabilities without introducing a second compliance system or asserting
country-specific legal requirements that have not been separately implemented
and verified.

## Existing authorities inspected

- `app/src/audit/audit-boundary.js`
- `backend/lib/store-sqlite.js#recordAuditEvent`
- `backend/lib/store-sqlite.js#audit_retention_policies`
- `backend/lib/store-sqlite.js#compliance_requests`
- `backend/lib/store-sqlite.js#buildComplianceExport`
- `backend/server.js` compliance routes
- Phase 10.7 compliance/audit hardening

The roadmap defines the audit/compliance target around actor, organization,
location, resource, action, reason, timestamp, device, result and metadata,
while retaining the existing `audit_events` authority. The roadmap also calls
for retention, access history, deletion workflow, and export/access-request
capability.

## Implementation

Added:

- `app/src/country-compliance-boundary.js`

The bridge exposes Ethiopia compliance metadata and references the existing
Core capabilities for:

- audit history
- retention policy
- access requests
- export requests
- deletion requests

Country-specific regulatory rules remain explicitly:

```text
country_defined_deferred
```

This phase therefore does not claim Ethiopian legal/fiscal compliance by
itself. Legal rules, retention periods, regulatory reporting, or other
country-specific obligations require a separately approved implementation and
verification phase.

## Source-of-truth rules

| Concern | Authority |
|---|---|
| Country pack declaration | `app/src/country-pack-contract.js` |
| Audit persistence | existing `audit_events` / `recordAuditEvent()` |
| Audit boundary | `app/src/audit/audit-boundary.js` |
| Retention policy | existing `audit_retention_policies` / Core compliance API |
| Compliance requests | existing `compliance_requests` / Core compliance API |
| Compliance export | existing Core compliance export capability |
| Country regulatory rules | deferred; no authority introduced |

## Non-build decisions

This phase does **not** introduce:

- country compliance database tables
- country compliance ledger
- second audit store
- second retention store
- country-specific request workflow
- country-specific export store
- regulatory reporting engine
- legal-rule engine
- tax authority or invoice authority
- payment authority

## Regression

`npm run test:phase14.8` must verify:

- Ethiopia resolves through the country contract
- existing Core audit/compliance authorities are referenced
- required compliance capabilities are exposed
- country regulatory rules remain deferred
- no country compliance persistence exists
- no duplicate audit/compliance authority exists
- non-Ethiopia country codes fail closed under the current Phase 14 single-country implementation
