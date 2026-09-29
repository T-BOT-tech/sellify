export const VERIFICATION_MODES = Object.freeze([
  'notification-only',
  'provider-status',
  'combined',
  'reconciliation-required',
]);

const DEFAULT_POLICY = Object.freeze({
  mode: 'notification-only',
  requireIndependentConfirmation: false,
});

export function normalizeVerificationPolicy(input = {}) {
  const mode = String(input.mode || DEFAULT_POLICY.mode).trim().toLowerCase();
  if (!VERIFICATION_MODES.includes(mode)) {
    throw Object.assign(new Error(`Unsupported payment verification mode: ${mode}`), {
      statusCode: 400,
      code: 'PAYMENT_VERIFICATION_POLICY_INVALID',
    });
  }

  const requireIndependentConfirmation =
    input.requireIndependentConfirmation == null
      ? mode === 'provider-status' || mode === 'combined' || mode === 'reconciliation-required'
      : Boolean(input.requireIndependentConfirmation);

  return Object.freeze({
    mode,
    requireIndependentConfirmation,
  });
}

export function resolveVerificationPolicy({ paymentAccount = null, paymentIntent = null } = {}) {
  // Provider metadata is adapter capability/configuration, not tenant payment
  // policy. Keep policy resolution synchronous and explicitly scoped to the
  // account/intent configuration authorities.
  const configured = paymentAccount?.metadata?.verificationPolicy
    ?? paymentIntent?.metadata?.verificationPolicy
    ?? {};

  return normalizeVerificationPolicy(configured);
}

export function requiresIndependentConfirmation(policy) {
  return normalizeVerificationPolicy(policy).requireIndependentConfirmation;
}
