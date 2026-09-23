# Contributing to Sellify

Sellify is an offline-first commerce platform with a multi-tenant backend. Contributions should preserve the existing domain boundaries and avoid introducing parallel engines for capabilities that already exist.

## Before changing code

1. Read `README.md` for the repository layout and runtime contract.
2. Read `SELLIFY_AI_HANDOFF.md` for architectural constraints and implementation handoff context.
3. Check the relevant Phase/FUX/TG implementation handoff before modifying an established capability.
4. Preserve tenant, organization, location, membership, authorization, idempotency, audit, and event boundaries.

## Runtime

- Required release runtime: **Node.js 24+**.
- Do not promote Node 22 test results to Node 24 certification.
- Backend runtime dependencies intentionally remain minimal; avoid adding a dependency when the platform/runtime already provides the required capability.

## Pull requests

Every PR should explain:
- what changed;
- why the change is needed;
- which existing contracts are affected;
- tests or regression gates run;
- any remaining release blockers.

Do not commit secrets, runtime data, SQLite databases, backups, generated local state, or private credentials.
