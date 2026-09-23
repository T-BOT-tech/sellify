// Phase 21.13 — Adversarial / Idempotency Regression helpers.
// Test-only orchestration around existing Phase 21 projections. This module
// owns no persistence, transaction, inventory, procurement, payment, ranking,
// trust, event, or provider authority.

export const PHASE21_ADVERSARIAL_IDEMPOTENCY_VERSION = '1.0';

export function replayFingerprint(value) {
  if (value === null || value === undefined || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(replayFingerprint).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${replayFingerprint(value[k])}`).join(',')}}`;
}

export function assertSafeReplay(first, replay) {
  const a = replayFingerprint(first);
  const b = replayFingerprint(replay);
  if (a !== b) {
    const error = new Error('Phase 21 replay produced a different canonical projection');
    error.code = 'PHASE21_REPLAY_MISMATCH';
    throw error;
  }
  return true;
}

export function assertNoExecutionAuthority(value, label = 'projection') {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must be an object`);
  const forbidden = ['authorization','orderCreation','procurementAward','inventoryReservation','paymentExecution','providerExecution','execution'];
  for (const key of forbidden) {
    if (value[key] === true) throw new Error(`${label} unexpectedly carries ${key}`);
  }
  return true;
}

export function phase21AdversarialContract() {
  return Object.freeze({
    version: PHASE21_ADVERSARIAL_IDEMPOTENCY_VERSION,
    persistence: 'none',
    mutation: false,
    deterministicReplay: true,
    sameInputSameProjection: true,
    differentInputMustNotAlias: true,
    unknownNeverSuccess: true,
    conflictMustNotAuthorize: true,
    executionDelegatesToOwningDomain: true,
    principle: 'adversarial regression verifies boundaries; it does not create a second authority',
  });
}
