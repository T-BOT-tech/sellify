import { requirePaymentProvider } from './provider-registry.js';
import { InvariantGate } from './invariant-gate.js';
import { PaymentDecisionEngine } from './decision-engine.js';

const STATUS_TO_VERIFICATION = Object.freeze({
  SUCCESS: 'MATCH',
  FAILED: 'MISMATCH',
  PENDING: 'PENDING',
  UNKNOWN: 'UNVERIFIABLE',
});

function statusReasonCodes(status) {
  if (status === 'PENDING') return ['PROVIDER_PAYMENT_PENDING'];
  if (status === 'FAILED') return ['PROVIDER_PAYMENT_FAILED'];
  if (status === 'UNKNOWN') return ['PROVIDER_STATUS_UNKNOWN'];
  return [];
}

export async function queryPaymentStatus({ chatId, paymentId, transactionId = null, externalReference = null, actor = null, store, clock = () => new Date() }) {
  if (!store) throw new TypeError('queryPaymentStatus requires store');
  const payment = await store.getPayment(chatId, paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  const intent = payment.paymentIntentId ? await store.getPaymentIntent(chatId, payment.paymentIntentId) : null;
  if (!intent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });

  const accounts = await store.listPaymentAccounts(chatId, { status: 'all' });
  const account = accounts.find(item => String(item.id) === String(payment.paymentAccountId));
  if (!account) throw Object.assign(new Error('Payment account not found'), { statusCode: 409, code: 'PAYMENT_ACCOUNT_NOT_FOUND' });
  if (String(account.status).toLowerCase() !== 'active') throw Object.assign(new Error('Payment account is not active'), { statusCode: 409, code: 'PAYMENT_ACCOUNT_INACTIVE' });

  const provider = requirePaymentProvider(payment.providerId);
  if (!provider.capabilities.getStatus) {
    const error = new Error(`Payment provider ${provider.id} does not support status queries`);
    error.statusCode = 501;
    error.code = 'PAYMENT_PROVIDER_STATUS_UNSUPPORTED';
    error.providerId = provider.id;
    throw error;
  }

  const providerStatus = await provider.getStatus({
    providerId: provider.id,
    paymentAccountId: account.id,
    accountIdentifier: account.accountIdentifier,
    paymentId: payment.id,
    paymentIntentId: intent.id,
    transactionId: transactionId || null,
    externalReference: externalReference || payment.externalReference || null,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });

  const observedReference = providerStatus.externalReference || externalReference || payment.externalReference || null;
  const fingerprint = `status:${provider.id}:${providerStatus.providerTransactionId || observedReference || payment.id}:${providerStatus.status}`;
  const evidenceResult = await store.insertPaymentEvidence(chatId, {
    paymentId: payment.id,
    paymentIntentId: intent.id,
    providerId: provider.id,
    channel: 'api',
    evidenceType: 'PROVIDER_STATUS',
    externalReference: observedReference,
    providerTransactionId: providerStatus.providerTransactionId,
    fingerprint,
    rawPayload: providerStatus.raw,
    normalizedPayload: providerStatus,
    source: 'provider-status-query',
    observedAt: providerStatus.occurredAt,
  }, actor);
  const evidence = evidenceResult.evidence;

  const verification = {
    providerId: provider.id,
    result: STATUS_TO_VERIFICATION[providerStatus.status] || 'UNVERIFIABLE',
    observedAmountMinor: providerStatus.amountMinor,
    observedCurrency: providerStatus.currency,
    observedReceiverAccount: providerStatus.receiverAccount || account.accountIdentifier,
    observedReference,
    observedTransactionId: providerStatus.providerTransactionId,
    observedAt: providerStatus.occurredAt,
    reasonCodes: statusReasonCodes(providerStatus.status),
    rawResult: providerStatus.raw,
    verifier: 'provider-status',
    verifierVersion: provider.version,
  };

  if (verification.result === 'MATCH' || verification.result === 'MISMATCH') {
    const invariants = new InvariantGate().evaluate({ payment, paymentIntent: intent, paymentAccount: account, evidence, verification, now: clock() });
    const decision = new PaymentDecisionEngine().decide({ payment, verification, invariants });
    if (decision.targetState && ['VERIFIED','MISMATCH','PARTIAL','DUPLICATE','EXPIRED'].includes(decision.targetState)) {
      const committed = await store.commitPaymentDecision(chatId, {
        paymentId: payment.id,
        paymentIntentId: intent.id,
        evidenceId: evidence.id,
        expectedState: payment.state,
        verification,
        decision: { ...decision, evidenceId: evidence.id, decisionSource: 'PROVIDER_STATUS', invariantResults: invariants },
      }, actor);
      return { payment: committed, intent, evidence, verification, invariants, decision, providerStatus, duplicateEvidence: evidenceResult.duplicate };
    }
    return { payment, intent, evidence, verification, invariants, decision, providerStatus, duplicateEvidence: evidenceResult.duplicate };
  }

  const verificationRecord = await store.insertPaymentVerification(chatId, { paymentId: payment.id, paymentIntentId: intent.id, evidenceId: evidence.id, providerId: provider.id, ...verification }, actor);
  return { payment, intent, evidence, verification: verificationRecord, decision: null, providerStatus, duplicateEvidence: evidenceResult.duplicate };
}
