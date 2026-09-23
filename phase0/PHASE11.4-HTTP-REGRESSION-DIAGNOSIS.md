# Phase 11.4 HTTP Regression Harness Diagnosis

## Objective

Determine why the existing marketplace HTTP regression reported:

`AssertionError: 400 !== 200`

at the checkout assertion.

## Root cause confirmed

The regression spawned the HTTP server with an isolated `SELLIFY_DATA_DIR`, but
the test process itself did not set the same environment variable before
importing `backend/lib/store-sqlite.js`.

`store-sqlite.js` resolves its database path from `SELLIFY_DATA_DIR` when the
module is initialized. Consequently:

```text
HTTP child process
  -> isolated temporary SQLite database

Regression parent process
  -> default backend database
```

The seller tenant and catalog fixture were created in the parent/default
 database, while the HTTP checkout searched the isolated child database. The
server correctly returned:

`Unknown seller`

This was a regression-harness isolation defect, not a marketplace checkout
implementation defect.

## Corrective action

The regression now sets the parent process environment to the same temporary
`SELLIFY_DATA_DIR` and backup directory used by the HTTP child before importing
the store module.

No marketplace business logic was changed.

## Additional control alignment

The regression also now reflects the actual current source contracts:

- organization identity is read from `sellerSession.organizationId`;
- single-payment allocation assertions select the allocation associated with
  the specific Payment Core record;
- aggregate over-allocation is rejected during `createPayment()` by the current
  marketplace payment allocation bridge;
- the concurrency fixture uses the stock remaining at that point in the test.

## Verification

With the harness corrections, the Phase 11.4 Marketplace Integrity regression
passes under the available Node `v22.16.0` runtime.

The repository declares Node `>=24`; therefore this is diagnostic verification
only. No Node >=24 release certification is claimed.
