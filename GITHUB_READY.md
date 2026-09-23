# GitHub-Ready Snapshot

This file records repository hygiene work applied to the existing Sellify snapshot before publication.

## Preserved

- Existing application/backend source tree.
- Existing Phase 0–22, FUX, TG, P0/P1, R1/R2 implementation and handoff documents.
- Existing regression scripts and source-hash evidence.
- Existing architecture and domain boundaries.

## Added for repository readiness

- `.gitignore` for secrets, local runtime data, dependencies, logs, and generated release evidence.
- `.nvmrc` and `.node-version` declaring Node 24.
- Node `>=24` engine declarations at root, app, and backend package levels.
- `SECURITY.md` and `CONTRIBUTING.md`.
- GitHub Actions CI for Node 24 baseline verification.
- GitHub Actions source-hygiene checks.

## Important release status

The repository is **GitHub-ready as a source snapshot**, but that does not mean production release certification is complete. In particular, Node 24 runtime certification and the project's documented external-integration/device/production evidence gates must still be executed where their handoff documents require them.

No historical phase evidence has been rewritten to make an older runtime appear certified.
