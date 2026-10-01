const DEFAULT_MAX_VERIFICATION_AGE_MS = 5 * 60 * 1000;
const MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;

export function evaluateVerificationFreshness({ observedAt, createdAt, now = new Date(), maxAgeMs = DEFAULT_MAX_VERIFICATION_AGE_MS } = {}) {
  const nowMs = new Date(now).getTime();
  const observedMs = new Date(observedAt || createdAt || '').getTime();
  const configuredMax = Number(maxAgeMs);
  const ageLimit = Number.isFinite(configuredMax) && configuredMax > 0
    ? Math.min(configuredMax, MAX_VERIFICATION_AGE_MS)
    : DEFAULT_MAX_VERIFICATION_AGE_MS;

  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs)) {
    return { fresh: false, reasonCode: 'VERIFICATION_OBSERVATION_TIME_INVALID', ageMs: null, maxAgeMs: ageLimit };
  }

  const ageMs = nowMs - observedMs;
  if (ageMs < -60 * 1000) {
    return { fresh: false, reasonCode: 'VERIFICATION_OBSERVATION_IN_FUTURE', ageMs, maxAgeMs: ageLimit };
  }
  if (ageMs > ageLimit) {
    return { fresh: false, reasonCode: 'VERIFICATION_STALE', ageMs, maxAgeMs: ageLimit };
  }
  return { fresh: true, reasonCode: null, ageMs: Math.max(0, ageMs), maxAgeMs: ageLimit };
}

export function assertVerificationFreshness(options = {}) {
  const result = evaluateVerificationFreshness(options);
  if (!result.fresh) {
    throw Object.assign(new Error('Payment verification is stale or has an invalid observation time'), {
      statusCode: 409,
      code: result.reasonCode,
      freshness: result,
    });
  }
  return result;
}
