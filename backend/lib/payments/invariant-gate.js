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
  'TRANSACTION_MISMATCH',
  'TRANSACTION_ID_MISSING',
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

    checks.push(check('PAYMENT_ACCOUNT_PROVIDER_MATCH',
      Boolean(paymentAccount && paymentIntent &&
        String(paymentAccount.providerId) === String(paymentIntent.providerId)),
      { required: true }));

    const observedAmount = verification?.observedAmountMinor;
    const paymentAmount = Number(payment?.amountMinor);
    const intentAmount = Number(paymentIntent?.amountMinor);
    checks.push(check('AMOUNT_MATCH',
      Number.isInteger(observedAmount) && Number.isInteger(paymentAmount) && Number(observedAmount) === paymentAmount,
      { required: true, expected: paymentAmount, observed: observedAmount ?? null }));
    checks.push(check('PAYMENT_INTENT_AMOUNT_MATCH',
      Number.isInteger(paymentAmount) && Number.isInteger(intentAmount) && paymentAmount === intentAmount,
      { required: true, expected: intentAmount, observed: paymentAmount }));

    const observedCurrency = String(verification?.observedCurrency || '').toUpperCase();
    const paymentCurrency = String(payment?.currency || '').toUpperCase();
    const intentCurrency = String(paymentIntent?.currency || '').toUpperCase();
    checks.push(check('CURRENCY_MATCH',
      Boolean(observedCurrency && paymentCurrency && observedCurrency === paymentCurrency),
      { required: true, expected: paymentCurrency || null, observed: observedCurrency || null }));
    checks.push(check('PAYMENT_INTENT_CURRENCY_MATCH',
      Boolean(paymentCurrency && intentCurrency && paymentCurrency === intentCurrency),
      { required: true, expected: intentCurrency || null, observed: paymentCurrency || null }));

    const receiverExpected = String(paymentAccount?.accountIdentifier || '').trim();
    const receiverObserved = String(verification?.observedReceiverAccount || '').trim();
    const receiverAvailable = Boolean(receiverExpected && receiverObserved);
    checks.push(check('RECEIVER_MATCH', receiverAvailable && receiverExpected === receiverObserved, {
      required: true, available: receiverAvailable, expected: receiverExpected || null, observed: receiverObserved || null,
    }));

    const referenceExpected = String(payment?.externalReference || '').trim();
    const referenceObserved = String(verification?.observedReference || '').trim();
    const referenceRequired = Boolean(referenceExpected);
    checks.push(check('REFERENCE_MATCH',
      !referenceRequired || (Boolean(referenceObserved) && referenceExpected === referenceObserved),
      { required: referenceRequired, expected: referenceExpected || null, observed: referenceObserved || null }));

    const transactionObserved = String(verification?.observedTransactionId || '').trim();
    const evidenceTransaction = String(evidence?.providerTransactionId || '').trim();
    checks.push(check('TRANSACTION_ID_PRESENT', Boolean(transactionObserved), {
      required: true, observed: transactionObserved || null,
    }));
    checks.push(check('TRANSACTION_EVIDENCE_BINDING',
      Boolean(transactionObserved && evidenceTransaction && transactionObserved === evidenceTransaction),
      { required: true, expected: evidenceTransaction || null, observed: transactionObserved || null }));

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
