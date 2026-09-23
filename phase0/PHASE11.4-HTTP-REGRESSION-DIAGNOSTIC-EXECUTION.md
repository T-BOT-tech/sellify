# Phase 11.4 HTTP Regression Diagnostic Execution

Observed runtime: v22.16.0

Command:
`node phase0/phase11.4-marketplace-integrity-regression.mjs`

Exit code: 1

Output:

```text
(node:3443) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:3455) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)

Phase 11.4 Marketplace Integrity Regression: FAIL
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

400 !== 200

    at [90mfile:///tmp/sellify_114_httpdiag_l3f1ozj1/sellify/[39mphase0/phase11.4-marketplace-integrity-regression.mjs:85:10
[90m    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)[39m {
  generatedMessage: [33mtrue[39m,
  code: [32m'ERR_ASSERTION'[39m,
  actual: [33m400[39m,
  expected: [33m200[39m,
  operator: [32m'strictEqual'[39m
}
```

Status: DIAGNOSTIC FAILURE — not a release certification result.
