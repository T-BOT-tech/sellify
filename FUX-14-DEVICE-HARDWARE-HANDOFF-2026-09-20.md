# FUX-14 Device & Hardware Experience — Continuation Handoff

## Status

FUX-14 experience contract implemented against the existing SELLIFY source. No new device, transaction, payment, inventory, authorization, notification, or persistence authority introduced.

## Implemented

- Device capability matrix for camera, barcode scanning, printing, Bluetooth, notifications, and biometrics.
- Explicit states: AVAILABLE, UNAVAILABLE, PERMISSION_REQUIRED, DEGRADED, DISCONNECTED, UNKNOWN.
- Adapter ownership remains outside domain authority.
- Degraded-device recovery messaging.
- UNKNOWN explicitly cannot be treated as successful device execution.
- Existing Web Bluetooth/printing adapters remain the concrete adapter path; the FUX-14 layer only composes their experience state.

## Regression

`npm run fux14:device-test` — PASS

`node phase0/golden-regression.mjs` — 21 PASS / 0 FAIL

`node phase0/phase21.14-cumulative-phase21-gate.mjs` — 220 PASS / 0 FAIL

`node phase0/phase21.15-node24-verification.mjs` — BLOCKED under runtime Node 22.16.0. The source declares Node >=24, but this environment does not satisfy the execution gate.

## Authority invariants

FUX-14 does not create a second Commerce, Payment, Inventory, Fulfillment, notification, or authorization authority. Device operations remain behind adapters and existing canonical backend/domain authorities.

## Next

Proceed to FUX-15 Accessibility together with FUX-16 Localization, with the existing state/design contracts as the baseline.

Final FUX certification remains deferred until the Node >=24 runtime gate and all FUX-25 gates are executed successfully.
