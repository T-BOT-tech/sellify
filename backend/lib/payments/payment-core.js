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
    this.invariantGate = invariantGate;
    this.decisionEngine = decisionEngine;
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

  async refund(command = {}) {
    this.#authorize(command, 'payments:manage');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    const idempotencyKey = String(command.idempotencyKey || command.idempotency_key || '').trim();
    if (!chatId || !paymentId || !idempotencyKey) {
      throw Object.assign(new Error('chatId, paymentId and idempotencyKey are required'), { statusCode: 400, code: 'REFUND_CONTEXT_REQUIRED' });
    }

    const existing = await this.store.getPaymentRefundByIdempotencyKey(chatId, idempotencyKey);
    if (existing) return { refund: existing, duplicate: true };

    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    if (!['VERIFIED', 'RECONCILED'].includes(String(payment.state).toUpperCase())) {
      throw Object.assign(new Error('Only VERIFIED or RECONCILED payments can be refunded'), { statusCode: 409, code: 'PAYMENT_NOT_REFUNDABLE' });
    }

    const amountMinor = Number(command.amountMinor ?? command.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw Object.assign(new Error('Refund amount must be a positive integer'), { statusCode: 400, code: 'INVALID_REFUND_AMOUNT' });
    }

    const provider = this.providerRegistry?.getPaymentProvider
      ? this.providerRegistry.getPaymentProvider(payment.providerId)
      : null;
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });

    const requested = await this.store.createPaymentRefundRequest(chatId, {
      paymentId,
      amountMinor,
      currency: command.currency || payment.currency,
      idempotencyKey,
      reason: command.reason || '',
    }, command.actor || null);
    if (requested.duplicate) return requested;

    if (provider.capabilities && provider.capabilities.refund === false) {
      const refund = await this.store.finalizePaymentRefund(chatId, requested.refund.id, {
        status: 'UNKNOWN',
        failureCode: 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED',
        evidence: { reason: 'Provider refund capability is not supported' },
        providerResult: { capability: 'refund', supported: false },
      }, command.actor || null);
      return { refund, supported: false, status: 'UNKNOWN', reasonCodes: ['PROVIDER_REFUND_UNAVAILABLE'] };
    }

    let raw;
    try {
      raw = await provider.refund({
        payment,
        paymentIntent: payment.paymentIntentId ? await this.store.getPaymentIntent(chatId, payment.paymentIntentId) : null,
        paymentAccount: (await this.store.listPaymentAccounts(chatId, { status: 'all' })).find(a => String(a.id) === String(payment.paymentAccountId)) || null,
        refund: requested.refund,
        request: command,
      });
    } catch (error) {
      if (['PAYMENT_PROVIDER_OPERATION_UNSUPPORTED', 'PAYMENT_PROVIDER_NOT_CONFIGURED'].includes(error?.code)) {
        const refund = await this.store.finalizePaymentRefund(chatId, requested.refund.id, {
          status: 'UNKNOWN',
          failureCode: error.code,
          evidence: { reason: error.message },
          providerResult: { error: error.code },
        }, command.actor || null);
        return { refund, supported: false, status: 'UNKNOWN', reasonCodes: ['PROVIDER_REFUND_UNAVAILABLE'] };
      }
      throw error;
    }

    const normalized = normalizeRefundResult(raw, requested.refund);
    const refund = await this.store.finalizePaymentRefund(chatId, requested.refund.id, {
      ...normalized,
      providerResult: raw,
      evidence: normalized,
    }, command.actor || null);

    return {
      refund,
      supported: true,
      status: normalized.status,
      duplicate: false,
      financialEffect: normalized.status === 'SUCCEEDED',
    };
  }

  async listRefunds(command = {}) {
    this.#authorize(command, 'payments:view');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    if (!chatId || !paymentId) throw Object.assign(new Error('chatId and paymentId are required'), { statusCode: 400, code: 'REFUND_CONTEXT_REQUIRED' });
    return { refunds: await this.store.getPaymentRefunds(chatId, paymentId, command.status ? { status: command.status } : {}) };
  }

  async transitionLifecycle(command = {}) {
    const target = String(command.targetState || command.target_state || '').trim().toUpperCase();
    const permission = target === 'CANCELLED' || target === 'REVERSED' ? 'payments:manage' : 'payments:accept';
    this.#authorize(command, permission);

    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    if (!chatId || !paymentId || !target) {
      throw Object.assign(new Error('chatId, paymentId and targetState are required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    }

    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });

    const allowed = new Set([
      'FAILED', 'EXPIRED', 'CANCELLED', 'REVERSED', 'RECEIVED',
    ]);
    if (!allowed.has(target)) {
      throw Object.assign(new Error('Unsupported lifecycle target'), { statusCode: 400, code: 'INVALID_PAYMENT_LIFECYCLE_TARGET' });
    }

    if (target === 'REVERSED' && !['VERIFIED', 'RECONCILED'].includes(String(payment.state).toUpperCase())) {
      throw Object.assign(new Error('Only VERIFIED or RECONCILED payments can be reversed'), { statusCode: 409, code: 'INVALID_REVERSAL_STATE' });
    }

    if (target === 'RECEIVED' && !['EXPIRED', 'CANCELLED'].includes(String(payment.state).toUpperCase())) {
      throw Object.assign(new Error('Late-success recovery is only valid from EXPIRED or CANCELLED'), { statusCode: 409, code: 'INVALID_LATE_SUCCESS_STATE' });
    }
    if (target === 'RECEIVED' && command.lateSuccess !== true && command.late_success !== true) {
      throw Object.assign(new Error('Late success must be explicitly identified'), { statusCode: 409, code: 'LATE_SUCCESS_CONFIRMATION_REQUIRED' });
    }

    const reason = String(command.reason || '').trim();
    if (!reason) throw Object.assign(new Error('A lifecycle transition reason is required'), { statusCode: 400, code: 'PAYMENT_REASON_REQUIRED' });

    const committed = await this.store.commitPaymentDecision(chatId, {
      paymentId,
      expectedState: payment.state,
      targetState: target,
      decision: {
        decision: target === 'REVERSED' ? 'REVERSE' : target === 'CANCELLED' ? 'CANCEL' : target === 'FAILED' ? 'FAIL' : target === 'EXPIRED' ? 'EXPIRE' : 'LATE_SUCCESS',
        targetState: target,
        reasonCodes: [target === 'REVERSED' ? 'PROVIDER_REVERSAL' : `PAYMENT_${target}`],
        decisionSource: 'PAYMENT_CORE',
        entryType: target,
        reason,
        metadata: {
          lifecycle: 'GAP-1.13',
          lateSuccess: target === 'RECEIVED',
          source: command.source || 'PAYMENT_CORE',
        },
      },
    }, command.actor || null);

    return {
      payment: committed,
      transition: {
        fromState: payment.state,
        toState: target,
        reason,
      },
    };
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

  // GAP-1.11: query provider status through the adapter boundary, normalize
  // the result into canonical evidence/verification, and only then allow the
  // existing invariant/decision/ledger machinery to change Payment state.
  // GAP-1.12: provider reconciliation is evidence collection only. It does
  // not mutate Payment state or write the ledger; later canonical decisions
  // must continue through the invariant/decision/commit path.
  async reconcile(command = {}) {
    this.#authorize(command, 'payments:reconcile');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    if (!chatId || !paymentId) {
      throw Object.assign(new Error('chatId and paymentId are required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    }
    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });

    const provider = this.providerRegistry?.getPaymentProvider
      ? this.providerRegistry.getPaymentProvider(payment.providerId)
      : null;
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });

    const intent = payment.paymentIntentId ? await this.store.getPaymentIntent(chatId, payment.paymentIntentId) : null;
    const accounts = await this.store.listPaymentAccounts(chatId, { status: 'all' });
    const paymentAccount = accounts.find(account => String(account.id) === String(payment.paymentAccountId)) || null;

    let raw;
    try {
      raw = await provider.reconcile({
        payment,
        paymentIntent: intent,
        paymentAccount,
        input: command.evidence || command,
      });
    } catch (error) {
      if (['PAYMENT_PROVIDER_OPERATION_UNSUPPORTED', 'PAYMENT_PROVIDER_NOT_CONFIGURED'].includes(error?.code)) {
        return {
          payment,
          supported: false,
          status: 'pending',
          reasonCodes: ['PROVIDER_RECONCILIATION_UNAVAILABLE'],
        };
      }
      throw error;
    }

    const normalized = normalizeReconciliation(raw, payment);
    const fingerprint = fingerprintReconciliation(payment, normalized);
    const recorded = await this.store.recordPaymentReconciliation(chatId, paymentId, {
      status: normalized.status,
      providerId: payment.providerId,
      externalReference: normalized.externalReference,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      reason: normalized.reason,
      fingerprint,
      observedAt: normalized.observedAt,
      evidence: normalized,
      source: 'PAYMENT_CORE',
    }, command.actor || null);

    return {
      payment,
      supported: true,
      status: normalized.status,
      reconciliation: recorded.reconciliation,
      duplicate: recorded.duplicate,
      ledgerMutated: false,
    };
  }

  async queryStatus(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    if (!chatId || !paymentId) {
      throw Object.assign(new Error('chatId and paymentId are required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });
    }

    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    const intent = payment.paymentIntentId
      ? await this.store.getPaymentIntent(chatId, payment.paymentIntentId)
      : null;
    if (!intent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });

    const accounts = await this.store.listPaymentAccounts(chatId, { status: 'all' });
    const paymentAccount = accounts.find(account => String(account.id) === String(payment.paymentAccountId));
    if (!paymentAccount) throw Object.assign(new Error('Payment account not found'), { statusCode: 404, code: 'PAYMENT_ACCOUNT_NOT_FOUND' });

    const provider = this.providerRegistry?.getPaymentProvider
      ? this.providerRegistry.getPaymentProvider(payment.providerId)
      : null;
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });

    let raw;
    try {
      raw = await provider.getStatus({
        payment,
        paymentIntent: intent,
        paymentAccount,
        query: command.query || command,
      });
    } catch (error) {
      if (['PAYMENT_PROVIDER_OPERATION_UNSUPPORTED', 'PAYMENT_PROVIDER_NOT_CONFIGURED'].includes(error?.code)) {
        return {
          payment,
          status: 'UNKNOWN',
          supported: false,
          reasonCodes: ['PROVIDER_STATUS_UNAVAILABLE'],
          providerId: payment.providerId,
        };
      }
      throw error;
    }

    const status = normalizeProviderStatus(raw);
    const verification = normalizeStatusVerification({ raw, status, payment, paymentIntent: intent });
    const evidencePayload = {
      paymentId,
      paymentIntentId: intent.id,
      providerId: payment.providerId,
      channel: 'api',
      evidenceType: 'PROVIDER_STATUS',
      externalReference: verification.observedReference || payment.externalReference || null,
      providerTransactionId: verification.observedTransactionId || null,
      observedAt: verification.observedAt || null,
      rawPayload: raw,
      normalizedPayload: verification,
      fingerprint: fingerprintStatusQuery(paymentId, payment.providerId, verification),
      source: 'provider.getStatus',
    };
    const evidenceResult = await this.store.insertPaymentEvidence(chatId, evidencePayload, command.actor || null);
    const evidence = evidenceResult.evidence;

    const invariants = this.invariantGate
      ? this.invariantGate.evaluate({
          payment,
          paymentIntent: intent,
          paymentAccount,
          evidence,
          verification,
          now: this.clock(),
        })
      : { passed: true, checks: [], reasonCodes: [], hardFailures: [] };

    const decision = this.decisionEngine
      ? this.decisionEngine.decide({ verification, invariants, payment })
      : { decision: 'RETRY_VERIFICATION', targetState: null, reasonCodes: verification.reasonCodes || [] };

    if (!decision.targetState) {
      const persistedVerification = await this.store.insertPaymentVerification(chatId, {
        paymentId,
        paymentIntentId: intent.id,
        evidenceId: evidence.id,
        providerId: payment.providerId,
        ...verification,
        reasonCodes: decision.reasonCodes,
        verifier: 'payment-core.provider-status',
        verifierVersion: '1',
      }, command.actor || null);
      const persistedDecision = await this.store.insertPaymentDecision(chatId, {
        paymentId,
        paymentIntentId: intent.id,
        evidenceId: evidence.id,
        verificationId: persistedVerification.id,
        decision: decision.decision,
        targetState: null,
        reasonCodes: decision.reasonCodes,
        invariantResults: invariants,
        decisionSource: 'PAYMENT_CORE',
      }, command.actor || null);
      return {
        payment,
        status: verification.result,
        supported: true,
        evidence,
        verification: persistedVerification,
        decision: persistedDecision,
        invariants,
      };
    }

    const committed = await this.store.commitPaymentDecision(chatId, {
      paymentId,
      expectedState: payment.state,
      targetState: decision.targetState,
      verification: {
        paymentIntentId: intent.id,
        evidenceId: evidence.id,
        providerId: payment.providerId,
        ...verification,
        reasonCodes: decision.reasonCodes,
        verifier: 'payment-core.provider-status',
        verifierVersion: '1',
      },
      decision: {
        paymentIntentId: intent.id,
        evidenceId: evidence.id,
        decision: decision.decision,
        targetState: decision.targetState,
        reasonCodes: decision.reasonCodes,
        invariantResults: invariants,
        decisionSource: 'PAYMENT_CORE',
        entryType: decision.targetState,
      },
    }, command.actor || null);

    return {
      payment: committed,
      status: verification.result,
      supported: true,
      evidence,
      invariants,
      decision,
    };
  }

  #authorize(command, permission) {
    if (!this.authorization) return;
    const allowed = this.authorization(command.actor || null, command.organizationId || null, command.locationId || null, 'payments', permission);
    if (allowed === false || allowed === 'DENY') {
      throw Object.assign(new Error('Payment permission required'), { statusCode: 403, code: 'UNAUTHORIZED_OPERATION' });
    }
  }
}

function normalizeRefundResult(raw = {}, refund = {}) {
  const value = String(raw.status ?? raw.result ?? raw.state ?? '').trim().toUpperCase();
  let status = 'UNKNOWN';
  if (['SUCCESS','SUCCEEDED','COMPLETED','REFUNDED','PROCESSED'].includes(value)) status = 'SUCCEEDED';
  else if (['FAILED','DECLINED','REJECTED'].includes(value)) status = 'FAILED';
  else if (['CANCELLED','CANCELED'].includes(value)) status = 'CANCELLED';
  return {
    status,
    providerRefundId: raw.refundId ?? raw.refund_id ?? raw.providerRefundId ?? raw.provider_refund_id ?? null,
    providerTransactionId: raw.transactionId ?? raw.transaction_id ?? raw.providerTransactionId ?? raw.provider_transaction_id ?? null,
    failureCode: raw.failureCode ?? raw.failure_code ?? null,
  };
}

function normalizeProviderStatus(raw = {}) {
  const value = String(raw.status ?? raw.result ?? raw.state ?? '').trim().toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'SETTLED', 'MATCH', 'CONFIRMED'].includes(value)) return 'MATCH';
  if (['FAILED', 'DECLINED', 'REJECTED', 'MISMATCH'].includes(value)) return 'MISMATCH';
  if (['DUPLICATE'].includes(value)) return 'DUPLICATE';
  if (['EXPIRED'].includes(value)) return 'EXPIRED';
  if (['PARTIAL'].includes(value)) return 'PARTIAL';
  return 'UNKNOWN';
}

function normalizeStatusVerification({ raw = {}, status, payment }) {
  const observedAmountMinor = raw.amountMinor ?? raw.amount_minor ?? raw.observedAmountMinor ?? raw.observed_amount_minor ?? null;
  const observedCurrency = raw.currency ?? raw.observedCurrency ?? raw.observed_currency ?? null;
  const observedReceiverAccount = raw.receiverAccount ?? raw.receiver_account ?? raw.observedReceiverAccount ?? raw.observed_receiver_account ?? null;
  const observedReference = raw.reference ?? raw.externalReference ?? raw.external_reference ?? raw.observedReference ?? raw.observed_reference ?? null;
  const observedTransactionId = raw.transactionId ?? raw.transaction_id ?? raw.providerTransactionId ?? raw.provider_transaction_id ?? null;
  const observedAt = raw.observedAt ?? raw.observed_at ?? null;
  return {
    result: status,
    confidence: raw.confidence == null ? null : Number(raw.confidence),
    observedAmountMinor: observedAmountMinor == null ? null : Number(observedAmountMinor),
    observedCurrency: observedCurrency == null ? null : String(observedCurrency).toUpperCase(),
    observedReceiver: raw.receiver ?? raw.observedReceiver ?? raw.observed_receiver ?? null,
    observedReceiverAccount: observedReceiverAccount == null ? null : String(observedReceiverAccount),
    observedReference: observedReference == null ? null : String(observedReference),
    observedTransactionId: observedTransactionId == null ? null : String(observedTransactionId),
    observedAt,
    rawResult: raw,
    reasonCodes: status === 'UNKNOWN' ? ['PROVIDER_STATUS_UNKNOWN'] : [],
    paymentId: payment.id,
  };
}

function fingerprintStatusQuery(paymentId, providerId, verification) {
  return [
    'GAP-1.11',
    String(providerId),
    String(paymentId),
    String(verification.observedTransactionId || ''),
    String(verification.result),
    String(verification.observedAmountMinor ?? ''),
    String(verification.observedReference || ''),
  ].join('|');
}

function normalizeReconciliation(raw = {}, payment = {}) {
  const value = String(raw.status ?? raw.result ?? raw.matched ?? '').trim().toUpperCase();
  let status = 'pending';
  if (['MATCH', 'MATCHED', 'TRUE', 'CONFIRMED', 'SUCCESS', 'RECONCILED'].includes(value) || raw.matched === true) status = 'matched';
  else if (['MISMATCH', 'MISMATCHED', 'FALSE', 'FAILED', 'REJECTED'].includes(value) || raw.matched === false) status = 'mismatched';
  const amountMinor = raw.amountMinor ?? raw.amount_minor ?? raw.observedAmountMinor ?? raw.observed_amount_minor ?? null;
  return {
    status,
    amountMinor: Number.isInteger(Number(amountMinor)) ? Number(amountMinor) : Number(payment.amountMinor || 0),
    currency: String(raw.currency || raw.observedCurrency || payment.currency || '').toUpperCase(),
    externalReference: raw.externalReference ?? raw.external_reference ?? raw.reference ?? null,
    providerTransactionId: raw.providerTransactionId ?? raw.provider_transaction_id ?? raw.transactionId ?? raw.transaction_id ?? null,
    reason: String(raw.reason || ''),
    observedAt: raw.observedAt ?? raw.observed_at ?? null,
    rawResult: raw,
  };
}

function fingerprintReconciliation(payment, normalized) {
  return [
    'GAP-1.12',
    String(payment.providerId),
    String(payment.id),
    String(normalized.status),
    String(normalized.providerTransactionId || ''),
    String(normalized.externalReference || ''),
    String(normalized.amountMinor),
    String(normalized.currency),
  ].join('|');
}
