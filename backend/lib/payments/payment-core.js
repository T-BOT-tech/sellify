import crypto from 'node:crypto';
import { getPaymentProvider } from './provider-registry.js';
import { InvariantGate } from './invariant-gate.js';
import { PaymentDecisionEngine } from './decision-engine.js';

export class PaymentCore {
  constructor({
    store,
    providerRegistry = null,
    invariantGate = null,
    decisionEngine = null,
    authorization = null,
    clock = () => new Date(),
  }) {
    if (!store) throw new TypeError('PaymentCore requires store');
    this.store = store;
    this.providerRegistry = providerRegistry || { getPaymentProvider };
    this.invariantGate = invariantGate || new InvariantGate();
    this.decisionEngine = decisionEngine || new PaymentDecisionEngine();
    this.authorization = authorization;
    this.clock = clock;
  }

  async createPayment(command = {}) {
    this.#authorize(command, 'payments:accept');
    if (command.state != null && String(command.state).toUpperCase() !== 'UNPAID') {
      throw Object.assign(new Error('Payment state is controlled by PaymentCore commands'), { statusCode: 409, code: 'STATE_NOT_CLIENT_CONTROLLED' });
    }
    const organizationId = String(command.organizationId || '').trim();
    const chatId = String(command.chatId || '').trim();
    if (!organizationId || !chatId) throw Object.assign(new Error('organizationId and chatId are required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });

    const result = await this.store.createPaymentWithIntent(chatId, {
      ...command,
      organizationId,
      idempotencyKey: command.idempotencyKey || command.idempotency_key,
    }, command.actor || null);

    return result;
  }

  async submitEvidence(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    if (!command.paymentIntentId && !command.payment_intent_id) {
      throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400, code: 'PAYMENT_INTENT_REQUIRED' });
    }

    return this.store.insertPaymentEvidence(chatId, {
      ...command,
      paymentIntentId: command.paymentIntentId || command.payment_intent_id,
    }, command.actor || null);
  }

  async verifyPayment(command = {}) {
    this.#authorize(command, 'payments:accept');
    return this.#runVerification(command, 'verify');
  }

  async retryVerification(command = {}) {
    this.#authorize(command, 'payments:accept');
    return this.#runVerification(command, 'retry');
  }

  async reconcilePayment(command = {}) {
    this.#authorize(command, 'payments:reconcile');
    return this.#runVerification(command, 'reconcile');
  }

  async #runVerification(command, operation) {
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    const evidenceId = String(command.evidenceId || command.evidence_id || '').trim();
    if (!chatId || !paymentId || !evidenceId) throw Object.assign(new Error('chatId, paymentId and evidenceId are required'), { statusCode: 400, code: 'PAYMENT_VERIFICATION_CONTEXT_REQUIRED' });
    const idempotencyKey = String(command.idempotencyKey || command.idempotency_key || '').trim();
    const commandType = 'payment.' + operation;
    const requestHash = idempotencyKey ? this.#commandHash(command, operation) : null;
    let idempotencyClaim = null;
    if (idempotencyKey && this.store.claimPaymentIdempotency) {
      idempotencyClaim = await this.store.claimPaymentIdempotency(chatId, {
        idempotencyKey, commandType, requestHash,
        resourceType: 'payment', resourceId: paymentId,
      });
      if (!idempotencyClaim.created) {
        if (idempotencyClaim.record.response_json != null) return JSON.parse(idempotencyClaim.record.response_json);
        throw Object.assign(new Error('Payment command is already in progress'), { statusCode: 409, code: 'IDEMPOTENCY_IN_PROGRESS' });
      }
    }
    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    const intentId = payment.paymentIntentId || command.paymentIntentId || command.payment_intent_id;
    const paymentIntent = intentId ? await this.store.getPaymentIntent(chatId, intentId) : null;
    if (!paymentIntent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });
    const evidenceRows = await this.store.listPaymentEvidence(chatId, paymentId);
    const evidence = (evidenceRows || []).find(row => String(row.id) === evidenceId);
    if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });
    const accounts = await this.store.listPaymentAccounts(chatId, { status: 'all' });
    const paymentAccount = (accounts || []).find(row => String(row.id) === String(paymentIntent.paymentAccountId));
    if (!paymentAccount) throw Object.assign(new Error('Payment account not found'), { statusCode: 409, code: 'PAYMENT_ACCOUNT_NOT_FOUND' });
    const providerId = String(payment.providerId || paymentIntent.providerId || '').toLowerCase();
    const provider = this.providerRegistry.getPaymentProvider(providerId);
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });
    if (operation === 'reconcile' && !provider.capabilities.reconcile) {
      throw Object.assign(new Error('Payment provider does not support reconciliation'), { statusCode: 501, code: 'PAYMENT_PROVIDER_RECONCILE_UNSUPPORTED' });
    }
    if (operation !== 'reconcile' && !provider.capabilities.verify) {
      throw Object.assign(new Error('Payment provider does not support verification'), { statusCode: 501, code: 'PAYMENT_PROVIDER_VERIFY_UNSUPPORTED' });
    }
    let observed = operation === 'reconcile'
      ? await provider.reconcile({ payment, paymentIntent, evidence, command })
      : await provider.verify({ payment, paymentIntent, evidence, command });
    const verification = await this.#normalizeVerification({ ...observed, providerId, paymentId, paymentIntentId: paymentIntent.id, evidenceId, verifier: provider.id, verifierVersion: provider.version }, evidence, chatId);
    const invariants = this.invariantGate.evaluate({ payment, paymentIntent, paymentAccount, evidence, verification, now: this.clock() });
    const decision = this.decisionEngine.decide({ payment, verification, invariants });
    if (!decision.targetState) {
      const response = { payment, paymentIntent, evidence, verification, invariants, decision };
      if (idempotencyKey && this.store.finalizePaymentIdempotency) await this.store.finalizePaymentIdempotency(chatId, { idempotencyKey, commandType, requestHash, response, responseStatus: 200, resourceType: 'payment', resourceId: paymentId });
      return response;
    }
    const committed = await this.store.commitPaymentDecision(chatId, {
      paymentId, paymentIntentId: paymentIntent.id, evidenceId, expectedState: payment.state, targetState: decision.targetState, verification,
      decision: { ...decision, paymentIntentId: paymentIntent.id, evidenceId, decisionSource: operation === 'retry' ? 'payment-core-retry' : 'payment-core-' + operation, actorId: command.actor?.userId || null }
    }, command.actor || null);
    const response = { ...committed, evidence, verification, invariants, decision };
    if (idempotencyKey && this.store.finalizePaymentIdempotency) await this.store.finalizePaymentIdempotency(chatId, { idempotencyKey, commandType, requestHash, response, responseStatus: 200, resourceType: 'payment', resourceId: paymentId });
    return response;
  }

  async #normalizeVerification(observed = {}, evidence = {}, chatId = null) {
    const result = String(observed.result || (observed.verified === true ? 'MATCH' : observed.matched === true ? 'MATCH' : 'UNVERIFIABLE')).toUpperCase();
    const transactionId = observed.observedTransactionId || observed.transactionId || observed.transaction_id || null;
    const reference = observed.observedReference || observed.reference || evidence.externalReference || null;
    const duplicateTransaction = transactionId && this.store.findPaymentEvidenceByProviderTransaction
      ? await this.store.findPaymentEvidenceByProviderTransaction(chatId, observed.providerId, transactionId, evidence.id)
      : null;
    const duplicateReference = reference && this.store.findPaymentEvidenceByReference
      ? await this.store.findPaymentEvidenceByReference(chatId, observed.providerId, reference, evidence.id)
      : null;
    return { id: observed.id, paymentId: observed.paymentId, paymentIntentId: observed.paymentIntentId, evidenceId: observed.evidenceId, providerId: observed.providerId, result, confidence: observed.confidence ?? null, observedAmountMinor: observed.observedAmountMinor ?? observed.amountMinor ?? observed.amount_minor ?? null, observedCurrency: observed.observedCurrency || observed.currency || null, observedReceiver: observed.observedReceiver || observed.receiver || null, observedReceiverAccount: observed.observedReceiverAccount || observed.receiverAccount || observed.receiver_account || null, observedReference: reference, observedTransactionId: transactionId, providerTransactionUnique: !duplicateTransaction, referenceUnique: !duplicateReference, observedAt: observed.observedAt || observed.observed_at || this.clock().toISOString(), reasonCodes: Array.isArray(observed.reasonCodes) ? observed.reasonCodes : [], rawResult: observed.rawResult ?? observed.raw ?? observed, verifier: observed.verifier, verifierVersion: observed.verifierVersion };
  }
  #authorize(command, permission) {
    if (!this.authorization) return;
    const allowed = this.authorization(command.actor || null, command.organizationId || null, command.locationId || null, 'payments', permission);
    if (allowed === false || allowed === 'DENY') {
      throw Object.assign(new Error('Payment permission required'), { statusCode: 403, code: 'UNAUTHORIZED_OPERATION' });
    }
  }
}  #commandHash(command, operation) {
    const stable = JSON.stringify({
      operation,
      organizationId: command.organizationId || null,
      locationId: command.locationId || null,
      paymentId: command.paymentId || command.payment_id || null,
      paymentIntentId: command.paymentIntentId || command.payment_intent_id || null,
      evidenceId: command.evidenceId || command.evidence_id || null,
    });
    return crypto.createHash('sha256').update(stable).digest('hex');
  }


