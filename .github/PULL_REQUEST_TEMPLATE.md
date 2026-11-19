## Task identity

- **Task ID:**
- **FUX / GAP / Phase requirement:**
- **Acceptance condition:**

## Architecture and duplicate-work preflight

- **Canonical authority being extended:**
- **Existing files/functions/routes/tables/migrations inspected:**
- **Related open or closed PRs / branches checked:**
- **Base branch and declared parent PR (if stacked):**
- **Why this is not duplicate or parallel implementation:**

## Unique change

- **Unique delta introduced by this PR:**
- **Inherited changes from parent branches:**
- **Changes explicitly deferred:**
- **Changed files and why each is necessary:**

## Authority and safety checks

- [ ] No duplicate domain authority, ledger, booking, payment, fulfillment, logistics, or execution path was introduced.
- [ ] Server/API authorization is authoritative; UI visibility is not treated as security.
- [ ] Tenant and organization scope are enforced at the server/data boundary.
- [ ] UNKNOWN is not represented as SUCCESS; preparation, authorization, and execution remain distinct.
- [ ] SQLite transaction ownership is preserved; no async yield occurs while a shared transaction is open.
- [ ] Schema migrations are forward-only, idempotent, and use a version checked against current main and every active migration branch.
- [ ] Any external provider behavior is behind the canonical contract/adapter boundary.

## Verification evidence

- **Exact tested commit SHA:**
- **Node version (must be >=24):**
- **Focused regression commands and results:**
- **Node 24 baseline run ID / result:**
- **Phase 13.10.24 run ID / result:**
- **Logistics L18 run ID / result:**
- **Logistics exit-certification run ID / result:**
- **Additional domain-specific regression / certification:**

- [ ] CI was rerun on the exact current PR head SHA.
- [ ] If this is a child PR, its integration-root PR has been identified and the root will be retested after the child is integrated.

## Integration and cleanup

- **Target integration PR / mainline:**
- **Source PRs superseded by this PR:**
- **Branches that must remain as dependencies/audit references:**
- **Branches safe to archive only after merge and dependent checks:**

> Do not create a new implementation branch until the related-work search above is complete. One task should have one active implementation branch and one active PR unless a separate dependency or scope is explicitly documented.
