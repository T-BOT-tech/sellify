# SELLIFY P1-IMPLEMENTATION-14 — Pack Recovery & Failure UX

Date: 2026-09-19

## Scope

Productize Pack recovery/failure states without introducing a second Pack lifecycle, recovery, IAM, or business-data authority.

## Implemented

- Added `app/src/authorization/pack-recovery.js`.
- Added Settings surface `packRecoveryPanel`.
- Reuses the canonical P1-13 readiness model and existing `UI_STATES` contract.
- Distinguishes:
  - dependency unavailable → `PROVIDER_UNAVAILABLE`
  - inactive configuration → `FAILURE`
  - declarative-only Pack → `PROVIDER_UNAVAILABLE`
  - unavailable executable journey → `FAILURE`
  - offline transport uncertainty → `UNKNOWN`
  - ready → `SUCCESS` as readiness evidence only
- Recovery actions are guidance labels, not Pack lifecycle mutations.
- Explicitly preserves the rule that offline/UNKNOWN does not mean success.
- Authorization remains separate from readiness and is still enforced by the canonical server authority.

## Authority boundaries

The surface does not create:

- Pack activation/deactivation state
- Pack entitlement storage
- Pack recovery queue
- approval authority
- IAM evaluator
- business-domain mutation authority

Existing Pack configuration/readiness authorities remain authoritative.

## Validation

- P1-14 focused regression: PASS
- FUX-29 seller golden journey: PASS
- FUX-30 multi-channel adversarial: PASS
- Node syntax checks: PASS

Node 22.16.0 was used for this validation environment. Node >=24 remains the release runtime certification requirement.
