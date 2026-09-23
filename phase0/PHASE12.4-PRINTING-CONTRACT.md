# Phase 12.4 — Printing Contract

**Status:** Implemented narrowly
**Date:** 2026-09-07
**Scope:** Establish a provider-neutral print-job/document contract without replacing the existing receipt UI or printer adapters.

## Source inspection

Phase 12.3 source was inspected before modification.

Existing printing behavior remains in:

- `app/src/orders/receipts.js` — existing receipt generation, browser print, copy/share and image receipt behavior.
- `app/src/printing/escpos.js` — existing provider-neutral ESC/POS encoding primitives.
- `app/src/printing/bluetooth.js` — existing Web Bluetooth transport boundary.

The roadmap's printing architecture requires a printer-neutral job and document boundary before provider-specific adapters. The architecture also requires adapters to remain outside the commerce core. fileciteturn2file0L30-L48

## Canonical print contract

Added:

```text
app/src/printing/contract.js
```

The contract currently supports the `receipt` document type.

Canonical job shape:

```text
{
  id,
  source,
  documentType,
  orderId,
  copies,
  document: {
    store,
    header,
    date,
    customer,
    items[],
    total,
    cashTendered,
    changeDue,
    footer
  },
  metadata
}
```

The contract is deliberately printer-neutral. It does not contain ESC/POS commands, browser print calls, Bluetooth UUIDs, USB details, network transport settings, or provider credentials.

## Authority

The existing order and receipt implementation remains authoritative for current retail receipt behavior.

The new module is a pure contract/normalization boundary. It does not persist print jobs and does not mutate orders, inventory, fulfillment, payment state, or audit records.

The future adapter relationship is:

```text
Print Job Contract
      ↓
Provider Adapter
      ↓
Printer / Runtime
```

This follows the project's canonical adapter rule and avoids making a provider schema the internal model. fileciteturn2file3L35-L50

## Compatibility

No existing receipt UI or browser printing path was replaced.

No ESC/POS implementation was moved into the contract.

No Bluetooth behavior was changed.

The contract can therefore be adopted incrementally by later adapters while the existing receipt flow continues to work.

## Migration

**None.**

This increment introduces no persistence schema and requires no data backfill.

## Tests

Added:

```text
phase0/phase12.4-printing-contract-regression.mjs
```

Covers:

- canonical receipt print-job shape
- deterministic job identity
- copy-count normalization
- document normalization
- metadata preservation
- source-document immutability
- unsupported document rejection
- invalid job rejection

Run:

```bash
npm run phase12.4:printing-contract-test
```

## Deliberately unchanged

- `app/src/orders/receipts.js`
- `app/src/printing/escpos.js`
- `app/src/printing/bluetooth.js`
- order schema
- fulfillment lifecycle
- inventory authority
- Payment Core
- warehouse system
- marketplace checkout

Reason: Phase 12.4 establishes the contract only. ESC/POS adapter work remains the next bounded increment, followed by Web Bluetooth and later warehouse hardening.

## Release boundary

Phase 12.4 does not claim printer-provider execution, print auditing, controlled reprint, USB/network printing, or native printing. Those remain later work.

Supported release certification still requires Node >=24. Any local verification under an older runtime must not be represented as Node 24 certification.

## Next step

**Phase 12.5 — ESC/POS Adapter**

The adapter should consume the provider-neutral print contract and delegate encoding to the existing ESC/POS primitives without moving printer-specific behavior into the commerce core.
