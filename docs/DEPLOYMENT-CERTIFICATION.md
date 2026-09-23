# Sellify Deployment Certification

## Purpose

Source/release certification proves that the repository and Node 24 release gates pass. Deployment certification proves that an actual deployed instance exposes the expected runtime contract.

The certification states are intentionally separate:

1. **SOURCE CERTIFIED** — repository tests and release controls pass.
2. **DEPLOYMENT VERIFIED** — a deployed URL passes the public smoke gate below.
3. **PRODUCTION OPERATIONAL** — controlled tenant, persistence, restore, Telegram, payment, and device evidence has also been collected.

Do not promote a public smoke pass into a production-operational claim.

## Public smoke gate

Run from a Node 24 environment:

```bash
SELLIFY_DEPLOYMENT_URL=https://your-deployment.example \
SELLIFY_EXPECTED_ENV=production \
node phase0/deployment-certification.mjs
```

The gate verifies:

- `GET /health` returns HTTP 200 and `ok=true`.
- `/health` reports the expected environment.
- `GET /` serves the PWA.
- `GET /config.js` is reachable and served as JavaScript.
- optional `POST /admin/backup` verification when `SELLIFY_BACKUP_TOKEN` is supplied.

If the backup token is omitted, backup is explicitly **DEFERRED**, not treated as proven.

## Controlled deployment evidence

The following must be tested against a non-production or dedicated certification tenant before calling a deployment production-operational:

| Evidence | Required | Result |
|---|---|---|
| Health + runtime | Yes | Public smoke gate |
| PWA + runtime config | Yes | Public smoke gate |
| Tenant authentication | Yes | Controlled credentials |
| Tenant A / Tenant B isolation | Yes | Controlled two-tenant test |
| Catalog create/read | Yes | Controlled tenant |
| Order creation + server-side total | Yes | Controlled tenant |
| Backup creation | Yes | Deployment secret |
| Restart persistence | Yes | Restart/redeploy |
| Restore into isolated environment | Yes | Backup artifact |
| Telegram live authentication | If enabled | Real bot credential |
| Payment-provider live flow | If enabled | Real provider evidence |
| Android/mobile device validation | Yes for release readiness | Physical device |

### Restart persistence

Because Sellify uses SQLite, production storage must survive process/container restarts. The deployment evidence must show:

1. create a uniquely identifiable certification record;
2. confirm it is readable;
3. restart/redeploy the same instance;
4. confirm the record still exists;
5. remove or quarantine certification data after the test.

### Restore verification

A backup is not sufficient evidence by itself. Restore the snapshot into an isolated data directory/database and verify that the restored database opens and preserves core organization, catalog, order, and audit rows.

### Tenant isolation

Use two distinct tenants. Authenticate each independently and verify:

- tenant A cannot read tenant B catalog/order data;
- tenant B cannot read tenant A data;
- public storefront/chat identifiers do not cross tenant boundaries;
- authorization failures do not leak protected records.

### Telegram and payments

Real Telegram credentials and payment-provider credentials are external deployment evidence. Repository regression tests do not prove that production credentials, webhook/configuration, provider accounts, network policy, or live provider behavior are correctly configured.

## Release decision matrix

- **PASS** — evidence was actually executed and passed.
- **PASS-WITH-DEFERRED** — the tested layer passes, but an explicitly identified external/deployment evidence item remains.
- **BLOCKED** — a required tested condition failed.
- **NOT-EVIDENCED** — no valid execution evidence exists.

Current source certification does not automatically imply deployment verification.
