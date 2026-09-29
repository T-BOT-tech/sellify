import crypto from 'node:crypto';
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
    this.providerRegistry = providerRegistry;
    this.authorization = authorization;
    this.clock = clock;
    this.invariantGate = invariantGate || new InvariantGate();
    this.decisionEngine = decisionEngine || new PaymentDecisionEngine();
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

  async verifyEvidence(command = {}) {
    this.#authorize(command, 'payments:accept');
    const evidenceId = String(command.evidenceId || command.evidence_id || '').trim();
    const chatId = String(command.chatId || '').trim();
    if (!chatId || !evidenceId) {
      throw Object.assign(new Error('chatId and evidenceId are required'), { statusCode: 400, code: 'PAYMENT_VERIFICATION_CONTEXT_REQUIRED' });
    }

    const evidence = await this.store.getPaymentEvidence(chatId, evidenceId);
    if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });
    if (!evidence.paymentIntentId) {
      return { outcome: 'UNMATCHED', evidence, verification: null, decision: null };
    }

    const paymentIntent = await this.store.getPaymentIntent(chatId, evidence.paymentIntentId);
    const payment = await this.store.getPaymentForIntent(chatId, evidence.paymentIntentId);
    const paymentAccount = paymentIntent?.paymentAccountId
      ? await this.store.getPaymentAccountById(chatId, paymentIntent.paymentAccountId)
      : null;
    if (!paymentIntent || !payment) {
      throw Object.assign(new Error('Payment intent/payment could not be resolved for evidence'), { statusCode: 409, code: 'PAYMENT_INTENT_MISMATCH' });
    }

    const priorVerifications = await this.store.listPaymentVerifications(chatId, payment.id);
    const priorVerification = priorVerifications?.find(item => String(item.evidenceId) === evidence.id);
    if (priorVerification) {
      const priorDecisions = await this.store.listPaymentDecisions(chatId, payment.id);
      const priorDecision = priorDecisions?.find(item => String(item.evidenceId) === evidence.id) || null;
      return {
        outcome: priorDecision?.targetState || priorVerification.result,
        evidence,
        verification: priorVerification,
        invariants: priorDecision?.invariantResults || null,
        decision: priorDecision,
        idempotent: true,
      };
    }

    const normalized = evidence.normalizedPayload || {};
    const verification = {
      providerId: evidence.providerId,
      result: 'MATCH',
      confidence: 1,
      observedAmountMinor: Number.isInteger(normalized.amountMinor) ? normalized.amountMinor : null,
      observedCurrency: normalized.currency || null,
      observedReceiver: normalized.receiver || null,
      observedReceiverAccount: normalized.receiver || null,
      observedReference: normalized.merchantReference || normalized.externalReference || evidence.externalReference || null,
      observedTransactionId: normalized.providerTransactionId || evidence.providerTransactionId || null,
      observedAt: normalized.providerTimestamp || evidence.observedAt || null,
      reasonCodes: [],
      rawResult: { source: evidence.source, normalizedPayload: normalized },
      verifier: 'payment-core',
      verifierVersion: 'notification-evidence-v1',
    };

    const invariants = this.invariantGate.evaluate({
      payment,
      paymentIntent,
      paymentAccount,
      evidence,
      verification,
      now: this.clock(),
    });
    if (!invariants.passed) verification.result = 'MISMATCH';
    verification.reasonCodes = invariants.reasonCodes;

    const decision = this.decisionEngine.decide({ verification, invariants, payment });
    const verificationId = crypto.randomUUID();
    const decisionId = crypto.randomUUID();
    let committedPayment;
    try {
      committedPayment = await this.store.commitPaymentDecision(chatId, {
        paymentId: payment.id,
        expectedState: payment.state,
        targetState: decision.targetState || payment.state,
      verification: {
        id: verificationId,
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
        evidenceId: evidence.id,
        providerId: evidence.providerId,
        result: verification.result,
        confidence: verification.confidence,
        observedAmountMinor: verification.observedAmountMinor,
        observedCurrency: verification.observedCurrency,
        observedReceiver: verification.observedReceiver,
        observedReceiverAccount: verification.observedReceiverAccount,
        observedReference: verification.observedReference,
        observedTransactionId: verification.observedTransactionId,
        observedAt: verification.observedAt,
        reasonCodes: verification.reasonCodes,
        rawResult: verification.rawResult,
        verifier: verification.verifier,
        verifierVersion: verification.verifierVersion,
      },
      decision: {
        id: decisionId,
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
        evidenceId: evidence.id,
        verificationId,
        decision: decision.decision,
        targetState: decision.targetState,
        reasonCodes: decision.reasonCodes,
        invariantResults: invariants,
        decisionSource: 'PAYMENT_CORE',
        reason: decision.reasonCodes.join(',') || 'Payment verification decision',
        entryType: decision.targetState || payment.state,
        metadata: { evidenceId: evidence.id, verificationId, decisionId },
        },
      }, command.actor || null);
    } catch (error) {
      if (error?.code !== 'PAYMENT_STATE_CONFLICT') throw error;
      const concurrentVerifications = await this.store.listPaymentVerifications(chatId, payment.id);
      const concurrentVerification = concurrentVerifications?.find(item => String(item.evidenceId) === evidence.id);
      if (!concurrentVerification) throw error;
      const concurrentDecisions = await this.store.listPaymentDecisions(chatId, payment.id);
      const concurrentDecision = concurrentDecisions?.find(item => String(item.evidenceId) === evidence.id) || null;
      committedPayment = await this.store.getPayment(chatId, payment.id);
      return {
        outcome: concurrentDecision?.targetState || concurrentVerification.result,
        payment: committedPayment,
        evidence,
        verification: concurrentVerification,
        invariants: concurrentDecision?.invariantResults || invariants,
        decision: concurrentDecision,
        idempotent: true,
        concurrent: true,
      };
    }

    const storedVerification = await this.store.getPaymentVerification(chatId, verificationId);
    const storedDecision = await this.store.getPaymentDecision(chatId, decisionId);

    return {
      outcome: decision.targetState || 'NO_STATE_CHANGE',
      payment: committedPayment,
      evidence,
      verification: storedVerification,
      invariants,
      decision: storedDecision,
    };
  }

  async submitEvidence(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    const paymentIntentId = command.paymentIntentId || command.payment_intent_id || null;
    const evidenceSource = String(command.source || '').trim().toLowerCase();
    if (!paymentIntentId && evidenceSource !== 'provider-notification') {
      throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400, code: 'PAYMENT_INTENT_REQUIRED' });
    }

    return this.store.insertPaymentEvidence(chatId, {
      ...command,
      paymentIntentId,
    }, command.actor || null);
  }

  #authorize(command, permission) {
    if (!this.authorization) return;
    const allowed = this.authorization(command.actor || null, command.organizationId || null, command.locationId || null, 'payments', permission);
    if (allowed === false || allowed === 'DENY') {
      throw Object.assign(new Error('Payment permission required'), { statusCode: 403, code: 'UNAUTHORIZED_OPERATION' });
    }
  }
}
