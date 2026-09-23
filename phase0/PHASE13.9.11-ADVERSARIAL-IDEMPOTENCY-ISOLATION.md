# Sellify Phase 13.9.11 — Adversarial / Idempotency / Isolation

## Status
COMPLETE — 2026-09-07

## Scope
Formalize adversarial boundary checks for the Warehouse Pack without creating
another domain authority or changing the locked operational modules.

## Contract
- Cross-organization product/location references are rejected.
- Missing organization identity is rejected.
- Inactive canonical locations are rejected.
- Missing products are rejected by the existing Inventory bridge.
- Warehouse operations preserve an explicit `event_id` as their idempotency
  identity.
- Repeated bridge construction with the same operation preserves the same
  `event_id`.
- Execution idempotency is delegated to the existing Core Inventory authority;
  this contract does not pretend that the legacy `applyStockChange()` function
  itself is an idempotent transaction processor.
- No Warehouse ledger, stock writer, location registry, or fulfillment authority
  is introduced.

## Isolation
The existing Inventory bridge already rejects cross-organization product and
location references. The Location bridge rejects cross-organization and inactive
canonical locations. Phase 13.9.11 regression coverage exercises those paths
explicitly.

## Migration
None.

## Verification
`npm run test:phase13.9.11` passes.

## Next
Phase 13.9.12 — Legacy Bin Compatibility.
