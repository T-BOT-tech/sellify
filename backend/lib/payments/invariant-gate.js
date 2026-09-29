const HARD_FAILURES = new Set([
  'ORGANIZATION_MISMATCH',
  'PAYMENT_INTENT_MISMATCH',
  'PAYMENT_ACCOUNT_OWNERSHIP',
  'PROVIDER_MISMATCH',
  'PAYMENT_ACCOUNT_PROVIDER_MISMATCH',
  'RECEIVER_MISMATCH',
  'AMOUNT_MISMATCH',
  'CURRENCY_MISMATCH',
  'REFERENCE_MISMATCH',
  'PROVIDER_TRANSACTION_DUPLICATE',
  'EVIDENCE_REPLAY',
  'INTENT_EXPIRED',
  'AUTHORIZATION_INVALID',
]);

function check(code, passed, details = {}) {
  return { code, passed: Boolean(passed), ...details };
}

export class InvariantGate {
  evaluate({ payment, paymentIntent, paymentAccount, evidence, verification, now = new Date() }) {
    const checks = [];
    const reasons = [];

    const org = String(payment?.organizationId || paymentIntent?.organizationId || '');
    checks.push(check('ORGANIZATION_MATCH',
      Boolean(payment && paymentIntent && org &&
        String(payment.organizationId) === String(paymentIntent.organizationId) &&
        (!paymentAccount || String(paymentAccount.organizationId) === org)),
      { required: true }));

    checks.push(check('PAYMENT_INTENT_MATCH',
      Boolean(payment && paymentIntent && String(payment.paymentIntentId || '') === String(paymentIntent.id || '')),
      { required: true }));

    checks.push(check('PAYMENT_ACCOUNT_OWNERSHIP',
      Boolean(paymentAccount && org && String(paymentAccount.organizationId) === org),
      { required: true }));

    checks.push(check('PROVIDER_MATCH',
      Boolean(payment && paymentIntent && evidence && verification &&
        String(payment.providerId) === String(paymentIntent.providerId) &&
        String(evidence.providerId) === String(paymentIntent.providerId) &&
        String(verification.providerId) === String(paymentIntent.providerId)),
      { required: true }));

    const evidenceAccountId = String(evidence?.paymentAccountId || '').trim();
    const intentAccountId = String(paymentIntent?.paymentAccountId || '').trim();
    checks.push(check('PAYMENT_ACCOUNT_BINDING_MISMATCH',
      Boolean(paymentAccount && evidenceAccountId && intentAccountId && evidenceAccountId === intentAccountId),
      { required: true, expected: intentAccountId || null, observed: evidenceAccountId || null }));

    checks.push(check('EVIDENCE_PROVIDER_MISMATCH',
      Boolean(evidence && paymentIntent && String(evidence.providerId) === String(paymentIntent.providerId)),
      { required: true, expected: paymentIntent?.providerId || null, observed: evidence?.providerId || null }));

    checks.push(check('PAYMENT_ACCOUNT_PROVIDER_MATCH',
      Boolean(paymentAccount && paymentIntent &&
        String(paymentAccount.providerId) === String(paymentIntent.providerId)),
      { required: true }));

    const observedAmount = verification?.observedAmountMinor;
    checks.push(check('AMOUNT_MATCH',
      Number.isInteger(observedAmount) && Number(observedAmount) === Number(payment.amountMinor),
      { required: true, expected: payment?.amountMinor ?? null, observed: observedAmount ?? null }));

    checks.push(check('CURRENCY_MATCH',
      Boolean(verification?.observedCurrency) &&
        String(verification.observedCurrency).toUpperCase() === String(payment.currency).toUpperCase(),
      { required: true, expected: payment?.currency ?? null, observed: verification?.observedCurrency ?? null }));

    const receiverExpected = String(paymentAccount?.accountIdentifier || '').trim();
    const receiverObserved = String(verification?.observedReceiverAccount || '').trim();
    const receiverAvailable = Boolean(receiverExpected && receiverObserved);
    checks.push(check('RECEIVER_MATCH', receiverAvailable && receiverExpected === receiverObserved, {
      required: true, available: receiverAvailable, expected: receiverExpected || null, observed: receiverObserved || null,
    }));

    const referenceExpected = String(payment.externalReference || evidence?.externalReference || '').trim();
    const referenceObserved = String(verification?.observedReference || '').trim();
    checks.push(check('REFERENCE_MATCH',
      !referenceExpected || !referenceObserved || referenceExpected === referenceObserved,
      { required: false, expected: referenceExpected || null, observed: referenceObserved || null }));

    checks.push(check('INTENT_NOT_EXPIRED',
      !paymentIntent?.expiresAt || new Date(paymentIntent.expiresAt).getTime() > new Date(now).getTime(),
      { required: true }));

    const evidenceStatus = String(evidence?.status || '').toUpperCase();
    checks.push(check('EVIDENCE_NOT_REPLAYED', !['DUPLICATE','EXPIRED'].includes(evidenceStatus), {
      required: true, evidenceStatus: evidenceStatus || null,
    }));

    for (const item of checks) {
      if (!item.passed && item.required) {
        const mapped = item.code === 'RECEIVER_MATCH' && !item.available ? 'RECEIVER_UNAVAILABLE' : item.code;
        reasons.push(mapped);
      }
    }

    return {
      passed: reasons.length === 0,
      checks,
      reasonCodes: [...new Set(reasons)],
      hardFailures: reasons.filter(code => HARD_FAILURES.has(code)),
    };
  }
}

export function evaluatePaymentInvariants(input) {
  return new InvariantGate().evaluate(input);
}
