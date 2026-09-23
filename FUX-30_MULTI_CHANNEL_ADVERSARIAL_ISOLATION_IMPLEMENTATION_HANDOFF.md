# FUX-30 — Multi-Channel Adversarial & Isolation Gate

## Objective
Attack the seller-owned channel model for tenant isolation, channel isolation, stale state, duplicate checkout, disabled channels, credential exposure, authorization bypass, canonical-authority bypass, and failure integrity.

## Implemented
- `app/src/platform/multi-channel-adversarial-contract.js`
- `phase0/fux30-multi-channel-adversarial-regression.mjs`
- npm script `fux30:multi-channel-adversarial-test`

## Authority rule
This is a deterministic validation contract only. It does not execute transactions, synchronize channels, persist channel business state, or create a new authority.

## Fail-closed rule
Missing/false adversarial checks fail the gate. The gate does not convert unknown or unavailable evidence into PASS.

## Definition of done
All defined adversarial cases pass and no forbidden duplicate channel authority is declared.
