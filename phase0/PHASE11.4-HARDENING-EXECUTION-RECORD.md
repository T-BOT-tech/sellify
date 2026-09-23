# Phase 11.4 Marketplace Integrity Hardening — Execution Record

## Current increment

- Payment Core → Marketplace SellerOrder identity bridge: implemented
- Split/partial payment allocation: implemented
- Inventory cancellation ledger reversal: implemented
- Static JavaScript syntax: PASS
- Direct payment-bridge/split-payment probe: PASS
- Observed runtime: v22.16.0
- Supported runtime declared by package.json: Node >=24
- Supported-runtime certification: PENDING

## Important test-harness finding

The existing Phase 11.4 HTTP regression currently fails at checkout with
`Unknown seller` in this environment. This is a test-harness/runtime
observation and is not being treated as a source-code certification result.

The direct in-process probe reaches the canonical Payment Core and marketplace
tables and verifies the newly hardened payment bridge.

## Probe output

```text
Phase 11.4 Marketplace Payment Bridge Probe: PASS
(node:3387) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

## Certification boundary

No Node >=24 release certification is claimed.
