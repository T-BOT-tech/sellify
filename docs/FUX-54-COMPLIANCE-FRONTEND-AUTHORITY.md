# FUX-54 — Compliance Frontend Authority

## Objective

Expose the existing canonical Compliance/Audit capability through the merchant UI without creating a second compliance record store.

## Authority

Compliance UI intent → canonical Compliance API → server authorization → compliance request / audit persistence → canonical response → UI projection.

Existing backend authority:
- GET/POST/PATCH /tenants/:chatId/compliance/requests
- GET/PATCH /tenants/:chatId/compliance/retention
- GET /tenants/:chatId/compliance/export/:subjectType/:subjectId
- GET /tenants/:chatId/compliance/export/:subjectType

The backend requires compliance:manage and records audited exports/resolutions.

## Implemented

- Settings now renders a Compliance panel for authorized sessions.
- Canonical request listing.
- Customer deletion-request creation.
- Approval/rejection through canonical PATCH.
- Organization JSON export through canonical export endpoint.
- No localStorage compliance ledger.
- FUX-54 regression and CI gate added.

## Evidence

Source integration is committed. CI certification remains pending until GitHub Actions reports a successful run for the latest commit chain.

Payment remains intentionally deferred.
