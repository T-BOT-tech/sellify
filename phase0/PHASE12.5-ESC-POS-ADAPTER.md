# Phase 12.5 — ESC/POS Adapter

**Status:** Implemented narrowly
**Date:** 2026-09-07
**Scope:** Bridge the Phase 12.4 provider-neutral print-job contract to the existing ESC/POS encoder.

## Source inspection

Phase 12.4 source was inspected before modification.

Existing printing behavior remains in:

- `app/src/printing/contract.js` — canonical provider-neutral print-job contract.
- `app/src/printing/escpos.js` — existing ESC/POS byte encoder.
- `app/src/orders/receipts.js` — existing retail receipt UI/browser-print behavior.
- `app/src/printing/bluetooth.js` — existing Web Bluetooth transport boundary.

## Adapter boundary

Added:

```text
app/src/printing/escpos-adapter.js
```

The relationship is:

```text
Canonical Print Job
      ↓
ESC/POS Adapter
      ↓
Existing ESC/POS Encoder
      ↓
Uint8Array
```

The adapter normalizes the canonical job, maps `orderId` into the existing
ESC/POS receipt encoder input, and returns provider-specific bytes plus the
canonical copy count.

## Authority

The adapter does not own orders, payments, fulfillment, inventory, audit,
print persistence, or transport connections.

The existing `escpos.js` encoder remains the encoding authority. The adapter
is only the compatibility boundary between the canonical print contract and
that existing implementation.

## Compatibility

No existing receipt UI or browser-print path was replaced.

No ESC/POS encoding primitives were rewritten.

No Bluetooth transport behavior was changed.

`copies` remains a print-job concern; the adapter returns it to the caller
rather than silently duplicating bytes or introducing transport logic.

## Migration

**None.**

No persistence or schema changes are required.

## Tests

Added:

```text
phase0/phase12.5-escpos-adapter-regression.mjs
```

Covers:

- adapter metadata
- canonical receipt job consumption
- provider-specific byte output
- preservation of copy count
- equivalence with the existing ESC/POS encoder
- source-job immutability
- invalid/missing job rejection
- unsupported document rejection

Run:

```bash
npm run phase12.5:escpos-test
```

The existing Phase 12.1, 12.2, 12.3, 12.4 and Phase 0 golden regressions
remain required.

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

Reason: Phase 12.5 establishes the ESC/POS adapter boundary only. Transport
execution and Web Bluetooth integration remain later bounded work.

## Release boundary

Phase 12.5 does not claim a physical printer connection, USB/network
transport, Bluetooth execution, print auditing, controlled reprint, or native
printing.

The project declares Node >=24. Any verification performed under an older
runtime is not Node 24 release certification.

## Next step

**Phase 12.6 — Web Bluetooth Adapter**

The next increment should consume the canonical/ESC-POS output through the
existing Web Bluetooth transport without moving browser/device behavior into
the commerce core.
