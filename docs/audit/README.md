# Sellify current-state architecture and boundary audit

Audit baseline: `main` at `e216db18ade2a5ffa66aff9dc3096e207251a918` (2026-11-23).

This directory is the current-state audit package. It records source-derived route, persistence, test, capability, capacity and architecture boundaries. The older `docs/perplexity-audit/` material is preserved as historical evidence and prior audit snapshots; it is not rewritten here. Where old claims conflict with current source, the current baseline in this directory takes precedence.

## Current outputs

- [Architecture map](./architecture-map.md)
- [Route characterization](./route-characterization.md) and [JSON inventory](./route-characterization.json)
- [SQLite dependency map](./sqlite-dependency-map.md) and [JSON inventory](./sqlite-dependency-map.json)
- [Capability Investment Matrix](./capability-investment-matrix.md)
- [Wave 0 baseline](./wave0-baseline.md)
- [Remediation roadmap](./remediation-roadmap.md)
- [Test command map](./test-command-map.md) and [JSON inventory](./test-command-map.json)
- [Capacity and Scheduling boundary](./capacity-scheduling-boundary.md)

## Audit constraints

- No production behavior, route code, schema, migrations, `package.json`, or CI workflow is changed by this audit.
- No route modules or SQLite store modules are extracted.
- Canonical domain authorities remain authoritative; Packs, business templates, experiences and channels compose capabilities but do not create duplicate truth.
- Static scanner evidence is labelled as such. A route filename match is not test coverage; a table/function name is not ownership; a transaction marker is not proof of atomicity. The Perplexity inventory workflow is used as an independent count gate, but its pre-check deduplication and name-based groupings are not treated as raw-source duplicate or canonical-ownership proof.
- All current-state claims are tied to the specified base commit and source locations. Historical hash manifests and audit records are retained without rewriting.

## Branch

Audit-only branch: `audit/route-sqlite-dependency-map`, created from the baseline commit above. Nothing has been merged.
