# Phase 12.8 — Physical Commerce Regression Gate

**Status:** Implemented and verified in the available runtime
**Date:** 2026-09-07
**Scope:** Final Phase 12 regression gate across the additive physical-commerce increments.

## Objective

Verify that Phase 12.1 through Phase 12.7 continue to pass together, while preserving the existing Phase 11.4 marketplace integrity and Phase 0 golden regression contracts.

The gate is a verification layer only. It does not introduce a new commerce, fulfillment, warehouse, inventory, payment, printing, or transport authority.

## Gate sequence

1. Phase 12.1 Physical/Printing Contract
2. Phase 12.2 Fulfillment Bridge
3. Phase 12.3 Physical Lifecycle
4. Phase 12.4 Printing Contract
5. Phase 12.5 ESC/POS Adapter
6. Phase 12.6 Web Bluetooth Adapter
7. Phase 12.7 Warehouse Hardening
8. Phase 11.4 Marketplace Integrity
9. Phase 0 Golden Regression

## Source-of-truth boundaries preserved

- Orders remain the commerce order authority.
- Fulfillment remains the physical lifecycle authority.
- `applyStockChange()` remains the local inventory mutation authority.
- The canonical inventory ledger remains authoritative for inventory movements.
- Payment Core remains the payment-state/ledger authority.
- The Phase 12 printing contract remains printer-neutral.
- ESC/POS remains an adapter/encoding boundary.
- Web Bluetooth remains a transport adapter.

These boundaries follow the project requirement for one commerce core, one inventory authority, one payment authority, and `Canonical Contract → Adapter → Provider`. 

## Migration

**None.** Phase 12.8 is a regression gate and introduces no schema migration or data rewrite.

## Verification command

```bash
npm run phase12.8:regression-gate
```

## Verification result

Expected successful result:

```text
Phase 12.1: PASS
Phase 12.2: PASS
Phase 12.3: PASS
Phase 12.4: PASS
Phase 12.5: PASS
Phase 12.6: PASS
Phase 12.7: PASS
Phase 11.4 Marketplace Integrity: PASS
Phase 0 Golden Regression: PASS
Phase 12.8 Physical Commerce Regression Gate: PASS
```

The available verification runtime is Node 22. The project declares Node >=24 because it uses `node:sqlite`. Therefore this evidence is a **pre-release verification run**, not supported-runtime release certification.

## Deliberately not changed

No production runtime requirement was lowered. No existing Phase 12 subsystem was rewritten merely to satisfy the gate. No duplicate inventory, fulfillment, commerce, payment, printer, or transport authority was introduced.

## Exit boundary

Phase 12 is structurally complete when this gate passes and the individual phase controls remain intact. The next roadmap phase is Phase 13 — Vertical Packs; it must not be started as part of this gate.
