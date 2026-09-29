import crypto from 'node:crypto';
import { getPaymentProvider, normalizeVerificationResult } from './provider-registry.js';
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
    verificationTimeoutMs = 30000,
    evidenceLeaseSeconds = 60,
  }) {
    if (!store) throw new TypeError('PaymentCore requires store');
    this.store = store;
    this.providerRegistry = providerRegistry || { getPaymentProvider };
    this.invariantGate = invariantGate || new InvariantGate();
    this.decisionEngine = decisionEngine || new PaymentDecisionEngine();
    this.authorization = authorization;
    this.clock = clock;
    this.verificationTimeoutMs = Number.isFinite(Number(verificationTimeoutMs)) && Number(verificationTimeoutMs) >= 1000
      ? Number(verificationTimeoutMs)
      : 30000;
    this.evidenceLeaseSeconds = Number.isInteger(Number(evidenceLeaseSeconds)) && Number(evidenceLeaseSeconds) >= 30 && Number(evidenceLeaseSeconds) <= 3600
      ? Number(evidenceLeaseSeconds)
      : 60;
    if (this.verificationTimeoutMs >= this.evidenceLeaseSeconds * 1000) {
      throw new RangeError('Payment provider verification timeout must be shorter than the evidence processing lease');
    }
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

  async ingestProviderNotification(command = {}) {
    const source = String(command.source || '').trim().toLowerCase();
    if (!['provider_webhook', 'provider_callback'].includes(source)) {
      throw Object.assign(new Error('Provider notification source is not allowed'), { statusCode: 400, code: 'INVALID_PROVIDER_NOTIFICATION_SOURCE' });
    }
    const actorType = String(command.actorType || command.actor_type || '').trim().toLowerCase();
    if (actorType !== 'system') {
      throw Object.assign(new Error('Provider notification ingestion requires a system actor'), { statusCode: 403, code: 'PROVIDER_NOTIFICATION_ACTOR_REQUIRED' });
    }
    const result = await this.submitEvidence({
      ...command,
      source,
      channel: command.channel || 'webhook',
      evidenceType: command.evidenceType || 'PROVIDER_NOTIFICATION',
      actor: command.actor || { userId: null, type: 'system' },
      allowOrphanNotification: true,
    });
    return { evidence: result.evidence, duplicate: Boolean(result.duplicate) };
  }

  async submitEvidence(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    if (!command.paymentIntentId && !command.payment_intent_id) {
      throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400, code: 'PAYMENT_INTENT_REQUIRED' });
    }

    const paymentIntentId = command.paymentIntentId || command.payment_intent_id || null;
    const isProviderNotification = ['provider_webhook', 'provider_callback'].includes(String(command.source || '').toLowerCase());
    if (!paymentIntentId && !isProviderNotification) {
      throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400, code: 'PAYMENT_INTENT_REQUIRED' });
    }
    const intent = paymentIntentId ? await this.store.getPaymentIntent(chatId, paymentIntentId) : null;
    if (paymentIntentId && !intent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });

    const providerId = String(command.providerId || command.provider_id || intent?.providerId || '').trim().toLowerCase();
    if (!providerId || (intent && providerId !== String(intent.providerId || '').toLowerCase())) {
      throw Object.assign(new Error('Evidence provider does not match payment intent provider'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
    }

    const provider = this.providerRegistry.getPaymentProvider(providerId);
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });

    const rawPayload = command.rawPayload ?? command.raw_payload ?? command.payload ?? null;
    let parsed = null;
    if (provider.capabilities.parseEvidence && rawPayload != null) {
      parsed = await provider.parseEvidence({ payload: rawPayload, command, paymentIntent: intent });
    }

    const normalizedPayload = parsed || command.normalizedPayload || command.normalized_payload || null;
    const externalReference = parsed?.reference || command.externalReference || command.external_reference || null;
    const providerTransactionId = parsed?.providerTransactionId || command.providerTransactionId || command.provider_transaction_id || null;
    if (!externalReference && !providerTransactionId) {
      throw Object.assign(new Error('Payment evidence requires a provider reference or transaction ID'), { statusCode: 422, code: 'EVIDENCE_IDENTIFIER_REQUIRED' });
    }
    const evidenceFingerprint = this.#evidenceFingerprint({
      providerId,
      externalReference,
      providerTransactionId,
      amountMinor: parsed?.amountMinor ?? command.amountMinor ?? command.amount_minor ?? command.amount ?? null,
      currency: parsed?.currency || command.currency || null,
      receiverAccount: parsed?.receiverAccount || command.receiverAccount || command.receiver_account || null,
    });

    return this.store.insertPaymentEvidence(chatId, {
      ...command,
      paymentIntentId,
      providerId,
      rawPayload,
      normalizedPayload,
      externalReference,
      providerTransactionId,
      observedAt: parsed?.observedAt || command.observedAt || command.observed_at || null,
      fingerprint: evidenceFingerprint,
    }, command.actor || null);
  }

  async ingestProviderNotification(command = {}) {
    const providerId = String(command.providerId || command.provider_id || '').trim().toLowerCase();
    if (!providerId) throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PROVIDER_REQUIRED' });
    const provider = this.providerRegistry.getPaymentProvider(providerId);
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });
    if (!provider.capabilities.parseEvidence) {
      throw Object.assign(new Error('Provider does not support notification evidence parsing'), { statusCode: 501, code: 'NOTIFICATION_PARSING_UNSUPPORTED' });
    }

    const verification = typeof provider.verifyNotification === 'function'
      ? await provider.verifyNotification({ payload: command.rawPayload ?? command.payload, headers: command.headers || {}, command })
      : { authenticated: true };

    if (verification?.authenticated === false) {
      throw Object.assign(new Error('Provider notification authentication failed'), { statusCode: 401, code: 'PROVIDER_NOTIFICATION_UNAUTHENTICATED' });
    }

    const parsed = await provider.parseEvidence({
      payload: command.rawPayload ?? command.payload,
      headers: command.headers || {},
      command,
      paymentIntent: null,
    });

    const providerTransactionId = parsed?.providerTransactionId || null;
    const externalReference = parsed?.reference || null;
    if (!providerTransactionId && !externalReference) {
      throw Object.assign(new Error('Provider notification requires a reference or transaction ID'), { statusCode: 422, code: 'EVIDENCE_IDENTIFIER_REQUIRED' });
    }

    const intent = await this.store.findPaymentIntentForProviderEvidence(command.chatId, {
      providerId,
      providerTransactionId,
      externalReference,
      receiverAccount: parsed?.receiverAccount || null,
    });
    if (!intent) {
      throw Object.assign(new Error('No payment intent matched provider notification'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND_FOR_NOTIFICATION' });
    }

    return this.submitEvidence({
      ...command,
      paymentId: intent.paymentId || null,
      paymentIntentId: intent.id,
      providerId,
      rawPayload: command.rawPayload ?? command.payload,
      actor: null,
      source: command.source || 'provider_notification',
      channel: command.channel || 'provider_webhook',
      allowOrphanNotification: isProviderNotification,
    });
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
    let processingAttempt = null;
    if (this.store.claimPaymentEvidenceProcessing) {
      const claim = await this.store.claimPaymentEvidenceProcessing(chatId, evidenceId, command.actor || null, { leaseSeconds: this.evidenceLeaseSeconds });
      if (claim.claimed) processingAttempt = claim.evidence?.processingAttempt ?? null;
      if (!claim.claimed) {
        if (claim.terminal) {
          const existing = await this.store.getPayment(chatId, paymentId);
          return { payment: existing, paymentIntent, evidence: claim.evidence, idempotent: true };
        }
        throw Object.assign(new Error('Payment evidence is already being processed'), { statusCode: 409, code: 'EVIDENCE_PROCESSING' });
      }
    } else if (this.store.transitionPaymentEvidence) {
      await this.store.transitionPaymentEvidence(chatId, { evidenceId, status: 'PROCESSING' }, command.actor || null);
    }
    let observed;
    let leaseRenewalTimer = null;
    try {
      if (this.store.renewPaymentEvidenceProcessing && processingAttempt != null) {
        const renewalIntervalMs = Math.max(1000, Math.floor((this.evidenceLeaseSeconds * 1000) / 2));
        leaseRenewalTimer = setInterval(() => {
          this.#renewEvidenceLease(chatId, evidenceId, processingAttempt, command.actor).catch(() => {});
        }, renewalIntervalMs);
      }
      observed = await this.#withVerificationTimeout((signal) =>
        operation === 'reconcile'
          ? provider.reconcile({ payment, paymentIntent, evidence, command: { ...command, signal } })
          : provider.verify({ payment, paymentIntent, evidence, command: { ...command, signal } })
      );
    } catch (error) {
      if (leaseRenewalTimer) clearInterval(leaseRenewalTimer);
      if (this.store.transitionPaymentEvidence) {
        await this.store.transitionPaymentEvidence(chatId, { evidenceId, status: 'RECEIVED', processingAttempt }, command.actor || null);
      }
      throw error;
    }
    if (leaseRenewalTimer) clearInterval(leaseRenewalTimer);
    const verification = await this.#normalizeVerification(normalizeVerificationResult(observed, {
      providerId, paymentId, paymentIntentId: paymentIntent.id, evidenceId, providerVersion: provider.version
    }), evidence, chatId);
    const invariants = this.invariantGate.evaluate({ payment, paymentIntent, paymentAccount, evidence, verification, now: this.clock() });
    const decision = this.decisionEngine.decide({ payment, verification, invariants });
    if (!decision.targetState) {
      const response = { payment, paymentIntent, evidence, verification, invariants, decision };
      if (this.store.transitionPaymentEvidence) await this.store.transitionPaymentEvidence(chatId, { evidenceId, status: 'UNVERIFIABLE', processingAttempt }, command.actor || null);
      if (idempotencyKey && this.store.finalizePaymentIdempotency) await this.store.finalizePaymentIdempotency(chatId, { idempotencyKey, commandType, requestHash, response, responseStatus: 200, resourceType: 'payment', resourceId: paymentId });
      return response;
    }
    const committed = await this.store.commitPaymentDecision(chatId, {
      paymentId, paymentIntentId: paymentIntent.id, evidenceId, expectedState: payment.state, targetState: decision.targetState, verification,
      decision: { ...decision, paymentIntentId: paymentIntent.id, evidenceId, decisionSource: operation === 'retry' ? 'payment-core-retry' : 'payment-core-' + operation, actorId: command.actor?.userId || null },
      idempotencyKey,
      idempotencyCommandType: idempotencyKey ? commandType : null,
      idempotencyRequestHash: idempotencyKey ? requestHash : null,
      processingAttempt,
    }, command.actor || null);
    const terminalStatus = decision.decision === 'MARK_DUPLICATE' ? 'DUPLICATE' : decision.targetState === 'EXPIRED' ? 'EXPIRED' : decision.targetState === 'VERIFIED' || decision.targetState === 'RECONCILED' ? 'VERIFIED' : decision.targetState === 'MISMATCH' || decision.targetState === 'REJECTED' ? 'REJECTED' : 'UNVERIFIABLE';
    if (this.store.transitionPaymentEvidence) await this.store.transitionPaymentEvidence(chatId, { evidenceId, status: terminalStatus, processingAttempt }, command.actor || null);
    const response = { ...committed, evidence, verification, invariants, decision };
    if (idempotencyKey && this.store.finalizePaymentIdempotency) await this.store.finalizePaymentIdempotency(chatId, { idempotencyKey, commandType, requestHash, response, responseStatus: 200, resourceType: 'payment', resourceId: paymentId });
    return response;
  }

  async #renewEvidenceLease(chatId, evidenceId, processingAttempt, actor) {
    if (!this.store.renewPaymentEvidenceProcessing || processingAttempt == null) return;
    return this.store.renewPaymentEvidenceProcessing(chatId, evidenceId, processingAttempt, actor || null, { leaseSeconds: this.evidenceLeaseSeconds });
  }

  async #withVerificationTimeout(operationFactory) {
    const controller = new AbortController();
    let timer = null;
    try {
      const operationPromise = Promise.resolve().then(() => operationFactory(controller.signal));
      return await Promise.race([
        operationPromise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error('Payment provider verification timed out'), {
              statusCode: 504,
              code: 'PAYMENT_PROVIDER_TIMEOUT',
            }));
          }, this.verificationTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
  #evidenceFingerprint(input = {}) {
    const stable = JSON.stringify({
      providerId: input.providerId || null,
      externalReference: input.externalReference || null,
      providerTransactionId: input.providerTransactionId || null,
      amountMinor: input.amountMinor ?? null,
      currency: input.currency || null,
      receiverAccount: input.receiverAccount || null,
    });
    return crypto.createHash('sha256').update(stable).digest('hex');
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


