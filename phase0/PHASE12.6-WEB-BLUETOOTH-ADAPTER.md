# Phase 12.6 — Web Bluetooth Adapter

**Status:** Implemented narrowly  
**Date:** 2026-09-07  
**Scope:** Bridge Phase 12.5 ESC/POS bytes to the existing Web Bluetooth transport.

## Source inspection

Phase 12.5 source was inspected before modification.

Existing printing behavior remains in:

- `app/src/printing/contract.js` — canonical provider-neutral print-job contract.
- `app/src/printing/escpos-adapter.js` — ESC/POS provider adapter.
- `app/src/printing/escpos.js` — existing ESC/POS byte encoder.
- `app/src/printing/bluetooth.js` — existing Web Bluetooth transport boundary.
- `app/src/orders/receipts.js` — existing receipt UI/browser-print behavior.

## Adapter boundary

Added:

```text
app/src/printing/web-bluetooth-adapter.js
```

The relationship is:

```text
Canonical Print Job
      ↓
ESC/POS Adapter
      ↓
Web Bluetooth Adapter
      ↓
Existing Web Bluetooth Transport
      ↓
Printer Characteristic
```

The adapter validates the Phase 12.5 ESC/POS result, preserves the canonical
job identity/copy count, and delegates the actual connection/write operation
to the existing `bluetooth.js` transport.

## Authority

The adapter does not own orders, payments, fulfillment, inventory, audit,
print persistence, printer discovery state, or Bluetooth transport primitives.

`bluetooth.js` remains the transport authority. Device-specific service and
characteristic identifiers remain caller-supplied, keeping hardware details
outside the commerce core.

## Compatibility

No existing Web Bluetooth functions were rewritten.

No ESC/POS encoding primitives were rewritten.

No receipt UI or browser-print path was replaced.

No commerce state is mutated by the adapter.

A transport dependency can be injected in tests so the adapter boundary is
verified without requiring a physical printer or browser Bluetooth runtime.
The production default is the existing `printEscPosBluetooth` transport.

## Migration

**None.**

No persistence or schema changes are required.

## Tests

Added:

```text
phase0/phase12.6-web-bluetooth-adapter-regression.mjs
```

Covers:

- adapter metadata
- ESC/POS input validation
- delegation to existing Web Bluetooth transport
- exact byte preservation
- device/service/characteristic propagation
- chunk-size propagation
- copy-count/job identity preservation
- source-result immutability
- invalid/missing input rejection
- unsupported Web Bluetooth environment rejection

Run:

```bash
npm run phase12.6:web-bluetooth-test
```

The existing Phase 12.1–12.5 regressions and Phase 0 golden regression
remain required.

## Deliberately unchanged

- `app/src/printing/bluetooth.js`
- `app/src/printing/escpos.js`
- `app/src/printing/escpos-adapter.js`
- `app/src/printing/contract.js`
- `app/src/orders/receipts.js`
- order schema
- fulfillment lifecycle
- inventory authority
- Payment Core
- warehouse system
- marketplace checkout

Reason: Phase 12.6 establishes the Web Bluetooth adapter boundary only.
Transport internals, device-specific behavior, and commerce state remain in
their existing authorities.

## Release boundary

Phase 12.6 does not claim physical-printer certification, device pairing
persistence, automatic printer discovery, USB/network printing, print audit
persistence, controlled reprint, or native printing.

The project declares Node >=24. Verification under an older runtime is not
Node 24 release certification.

## Next step

**Phase 12.7 — Warehouse Hardening**

The next increment should harden the existing warehouse/stock path around the
physical commerce lifecycle without introducing a second warehouse module or
inventory authority.
