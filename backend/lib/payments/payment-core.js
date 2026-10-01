import { assertUntrustedPaymentEvidenceShape } from './payment-evidence-authority.js';

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

  async resolveRouting(command = {}) {
    this.#authorize(command, 'payments:route');
    const chatId = String(command.chatId || '').trim();
    const channel = String(command.channel || '').trim().toLowerCase();
    const currency = String(command.currency || '').trim().toUpperCase();
    if (!chatId || !channel) throw Object.assign(new Error('chatId and channel are required'), { statusCode: 400, code: 'ROUTING_CONTEXT_REQUIRED' });
    const policies = await this.store.listPaymentRoutingPolicies(chatId, {
      channel, locationId: command.locationId || command.location_id || null, activeOnly: true,
    });
    const candidates = [];
    for (const policy of policies) {
      if (policy.currencies.length && currency && !policy.currencies.includes(currency)) continue;
      const provider = this.providerRegistry?.getPaymentProvider
        ? this.providerRegistry.getPaymentProvider(policy.providerId)
        : null;
      if (!provider) continue;
      const required = Array.isArray(policy.requiredCapabilities) ? policy.requiredCapabilities : [];
      if (required.some(capability => provider.capabilities?.[capability] !== true)) continue;
      const accounts = await this.store.listPaymentAccounts(chatId, { status: 'active' });
      const account = accounts.find(a => String(a.providerId) === String(policy.providerId) &&
        (!command.paymentAccountId || String(a.id) === String(command.paymentAccountId)));
      if (!account && command.requireAccount !== false) continue;
      candidates.push({ policy, provider, account: account || null });
    }
    if (!candidates.length) {
      return { status: 'UNKNOWN', reasonCodes: ['NO_ELIGIBLE_PAYMENT_ROUTE'], candidates: [] };
    }
    const selected = candidates[0];
    return {
      status: 'ROUTED',
      providerId: selected.provider.id,
      providerName: selected.provider.name,
      paymentAccountId: selected.account?.id || null,
      channel,
      policyId: selected.policy.id,
      priority: selected.policy.priority,
      reasonCodes: [],
    };
  }

  async createPayment(command = {}) {
    this.#authorize(command, 'payments:accept');
    if (command.state != null && String(command.state).toUpperCase() !== 'UNPAID') {
      throw Object.assign(new Error('Payment state is controlled by PaymentCore commands'), { statusCode: 409, code: 'STATE_NOT_CLIENT_CONTROLLED' });
    }
    const organizationId = String(command.organizationId || '').trim();
    const chatId = String(command.chatId || '').trim();
    if (!organizationId || !chatId) throw Object.assign(new Error('organizationId and chatId are required'), { statusCode: 400, code: 'PAYMENT_CONTEXT_REQUIRED' });

    let routedCommand = { ...command };
    if (!routedCommand.providerId && !routedCommand.provider_id) {
      const route = await this.resolveRouting({ ...command, actor: command.actor });
      if (route.status !== 'ROUTED') {
        throw Object.assign(new Error('No eligible payment route'), { statusCode: 409, code: 'NO_ELIGIBLE_PAYMENT_ROUTE', reasonCodes: route.reasonCodes });
      }
      routedCommand.providerId = route.providerId;
      routedCommand.paymentAccountId = routedCommand.paymentAccountId || route.paymentAccountId || undefined;
    }
    const result = await this.store.createPaymentWithIntent(chatId, {
      ...routedCommand,
      organizationId,
      idempotencyKey: command.idempotencyKey || command.idempotency_key,
    }, command.actor || null);

    return result;
  }

  async createSettlement(command = {}) {
    this.#authorize(command, 'payments:settlement:allocate');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    const idempotencyKey = String(command.idempotencyKey || command.idempotency_key || '').trim();
    if (!chatId || !paymentId || !idempotencyKey) {
      throw Object.assign(new Error('chatId, paymentId and idempotencyKey are required'), { statusCode: 400, code: 'SETTLEMENT_CONTEXT_REQUIRED' });
    }
    const existing = await this.store.getPaymentSettlementByIdempotencyKey(chatId, idempotencyKey);
    if (existing) return { settlement: existing, duplicate: true };
    const payment = await this.store.getPayment(chatId, paymentId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    const result = await this.store.createPaymentSettlement(chatId, {
      ...command,
      paymentId,
      idempotencyKey,
    }, command.actor || null);
    return { ...result, financialEffect: false };
  }

  async finalizeSettlement(command = {}) {
    this.#authorize(command, 'payments:settlement:allocate');
    const chatId = String(command.chatId || '').trim();
    const settlementId = String(command.settlementId || command.settlement_id || '').trim();
    if (!chatId || !settlementId) {
      throw Object.assign(new Error('chatId and settlementId are required'), { statusCode: 400, code: 'SETTLEMENT_CONTEXT_REQUIRED' });
    }
    const settlement = await this.store.finalizePaymentSettlement(chatId, settlementId, command, command.actor || null);
    return {
      settlement,
      financialEffect: false,
      paymentStateMutated: false,
    };
  }

  async listSettlements(command = {}) {
    this.#authorize(command, 'payments:settlement:view');
    const chatId = String(command.chatId || '').trim();
    const paymentId = String(command.paymentId || command.payment_id || '').trim();
    if (!chatId || !paymentId) throw Object.assign(new Error('chatId and paymentId are required'), { statusCode: 400, code: 'SETTLEMENT_CONTEXT_REQUIRED' });
    return { settlements: await this.store.listPaymentSettlements(chatId, paymentId, command.status ? { status: command.status } : {}) };
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

    assertUntrustedPaymentEvidenceShape(command);
    return this.store.insertPaymentEvidence(chatId, {
      ...command,
      paymentIntentId: command.paymentIntentId || command.payment_intent_id,
      source: 'caller.submitted',
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

  async recordOperationalAction(command = {}) {
    const actionType=String(command.actionType||command.action_type||'').trim().toUpperCase();
    this.#authorize(command,actionType==='MANUAL_REVIEW'?'payments:manage':'payments:view');
    const chatId=String(command.chatId||'').trim(),paymentId=String(command.paymentId||command.payment_id||'').trim();
    if(!chatId||!paymentId) throw Object.assign(new Error('chatId and paymentId are required'),{statusCode:400,code:'PAYMENT_CONTEXT_REQUIRED'});
    return this.store.createPaymentOperationalAction(chatId,command,command.actor||null);
  }

  async listOperationalActions(command = {}) {
    this.#authorize(command,'payments:view');
    const chatId=String(command.chatId||'').trim(),paymentId=String(command.paymentId||command.payment_id||'').trim();
    if(!chatId||!paymentId) throw Object.assign(new Error('chatId and paymentId are required'),{statusCode:400,code:'PAYMENT_CONTEXT_REQUIRED'});
    const actions=await this.store.listPaymentOperationalActions(chatId,paymentId,command);
    if(actions===null) throw Object.assign(new Error('Payment not found'),{statusCode:404,code:'PAYMENT_NOT_FOUND'});
    return {actions};
  }

  async resolveManualReview(command = {}) {
    this.#authorize(command,'payments:manage');
    const actionId=String(command.actionId||command.action_id||'').trim(),chatId=String(command.chatId||'').trim();
    const status=String(command.status||'').trim().toUpperCase();
    if(!actionId||!chatId) throw Object.assign(new Error('chatId and actionId are required'),{statusCode:400,code:'OPERATIONAL_ACTION_CONTEXT_REQUIRED'});
    if(!['RESOLVED','DISMISSED'].includes(status)) throw Object.assign(new Error('Manual review must resolve or dismiss'),{statusCode:400,code:'INVALID_MANUAL_REVIEW_STATUS'});
    return {action:await this.store.updatePaymentOperationalAction(chatId,actionId,{...command,status},command.actor||null)};
  }

  async retryOperationalAction(command = {}) {
    this.#authorize(command,'payments:manage');
    const chatId=String(command.chatId||'').trim(),paymentId=String(command.paymentId||command.payment_id||'').trim();
    const actionType=String(command.actionType||command.action_type||'').trim().toUpperCase();
    if(!chatId||!paymentId||!actionType) throw Object.assign(new Error('chatId, paymentId and actionType are required'),{statusCode:400,code:'OPERATIONAL_ACTION_CONTEXT_REQUIRED'});
    if(!['STATUS_QUERY','RECONCILIATION'].includes(actionType)){
      const created=await this.store.createPaymentOperationalAction(chatId,{paymentId,actionType:'MANUAL_REVIEW',operation:'RETRY_BLOCKED',reason:'Financial mutation retry requires manual review',idempotencyKey:command.idempotencyKey||command.idempotency_key},command.actor||null);
      await this.store.updatePaymentOperationalAction(chatId,created.action.id,{status:'BLOCKED',reason:'Financial mutation retry requires manual review'},command.actor||null);
      return {status:'BLOCKED',reasonCodes:['MANUAL_REVIEW_REQUIRED'],actionId:created.action.id};
    }
    const action=await this.store.createPaymentOperationalAction(chatId,{paymentId,actionType,operation:actionType+'_RETRY',reason:command.reason||'Operational retry requested',idempotencyKey:command.idempotencyKey||command.idempotency_key||null},command.actor||null);
    if(action.duplicate)return action;
    try{
      await this.store.updatePaymentOperationalAction(chatId,action.action.id,{status:'RUNNING'},command.actor||null);
      const result=actionType==='STATUS_QUERY'?await this.queryStatus(command):await this.reconcile(command);
      const saved=await this.store.updatePaymentOperationalAction(chatId,action.action.id,{status:'SUCCEEDED',result},command.actor||null);
      return {status:'SUCCEEDED',action:saved,result};
    }catch(error){
      const unknown=['PAYMENT_PROVIDER_OPERATION_UNSUPPORTED','PAYMENT_PROVIDER_NOT_CONFIGURED'].includes(error?.code);
      const status=unknown?'UNKNOWN':'FAILED';
      const saved=await this.store.updatePaymentOperationalAction(chatId,action.action.id,{status,errorCode:error?.code||'OPERATIONAL_RETRY_FAILED',reason:error?.message||'Operational retry failed'},command.actor||null);
      if(unknown)return {status:'UNKNOWN',action:saved,reasonCodes:['PROVIDER_OPERATION_UNKNOWN']};
      throw error;
    }
  }

  async recordProviderCapabilityEvidence(command = {}) {
    this.#authorize(command, 'payments:manage');
    const chatId = String(command.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
    if (!this.store.recordPaymentProviderCapabilityEvidence) {
      throw Object.assign(new Error('Provider capability evidence storage is unavailable'), { statusCode: 503, code: 'PROVIDER_EVIDENCE_UNAVAILABLE' });
    }
    return this.store.recordPaymentProviderCapabilityEvidence(chatId, command, command.actor || null);
  }

  async listProviderCapabilityEvidence(command = {}) {
    this.#authorize(command, 'payments:view');
    const chatId = String(command.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
    if (!this.store.listPaymentProviderCapabilityEvidence) {
      throw Object.assign(new Error('Provider capability evidence storage is unavailable'), { statusCode: 503, code: 'PROVIDER_EVIDENCE_UNAVAILABLE' });
    }
    return {
      evidence: await this.store.listPaymentProviderCapabilityEvidence(
        chatId,
        command.providerId || command.provider_id || null,
        { capability: command.capability, scope: command.certificationScope || command.certification_scope },
      ),
    };
  }

  async probeProviderCapability(command = {}) {
    this.#authorize(command, 'payments:manage');
    const chatId = String(command.chatId || '').trim();
    const providerId = String(command.providerId || command.provider_id || '').trim();
    const capability = String(command.capability || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
    if (!providerId) throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
    if (!capability) throw Object.assign(new Error('capability is required'), { statusCode: 400, code: 'PROVIDER_CAPABILITY_REQUIRED' });

    const provider = this.providerRegistry?.getPaymentProvider
      ? this.providerRegistry.getPaymentProvider(providerId)
      : null;
    if (!provider) throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });

    const { probeProviderCapability } = await import('./provider-capability-probe.js');
    const result = await probeProviderCapability(provider, {
      capability,
      context: {
        chatId,
        organizationId: command.organizationId || null,
        paymentAccountId: command.paymentAccountId || command.payment_account_id || null,
        request: command.probeContext || command.probe_context || {},
      },
    });

    if (this.store.recordPaymentProviderCapabilityEvidence) {
      const recorded = await this.store.recordPaymentProviderCapabilityEvidence(chatId, {
        ...result,
        organizationId: command.organizationId || null,
        providerId,
        capability,
        certificationScope: 'LIVE_EXTERNAL',
        status: result.status === 'VERIFIED' ? 'OBSERVED' : result.status,
        evidence: {
          ...result.evidence,
          probeStatus: result.status,
          reasonCodes: result.reasonCodes,
        },
        providerReference: result.providerReference,
        observedAt: result.observedAt,
        expiresAt: result.expiresAt,
      }, command.actor || null);
      return { probe: result, evidence: recorded, certification: 'UNCHANGED' };
    }

    return { probe: result, evidence: null, certification: 'UNCHANGED' };
  }

  async certifyProviderCapabilities(command = {}) {
    this.#authorize(command, 'payments:view');
    const providerId = String(command.providerId || command.provider_id || '').trim();
    if (!providerId) throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
    const registry = this.providerRegistry;
    if (!registry?.certifyPaymentProviderCapabilities) {
      throw Object.assign(new Error('Provider capability certification is unavailable'), { statusCode: 503, code: 'PROVIDER_CERTIFICATION_UNAVAILABLE' });
    }
    const certification = registry.certifyPaymentProviderCapabilities(providerId);
    const evidence = this.store.listPaymentProviderCapabilityEvidence
      ? await this.store.listPaymentProviderCapabilityEvidence(
          String(command.chatId || '').trim(),
          providerId,
          {},
        )
      : [];
    return { ...certification, evidence };
  }

  async certifyAllProviders(command = {}) {
    this.#authorize(command, 'payments:view');
    if (!this.providerRegistry?.certifyAllPaymentProviders) {
      throw Object.assign(new Error('Provider capability certification is unavailable'), { statusCode: 503, code: 'PROVIDER_CERTIFICATION_UNAVAILABLE' });
    }
    const providers = this.providerRegistry.certifyAllPaymentProviders();
    if (!this.store.listPaymentProviderCapabilityEvidence) return { providers };
    const chatId = String(command.chatId || '').trim();
    const evidence = await this.store.listPaymentProviderCapabilityEvidence(chatId, null, {});
    return {
      providers: providers.map(provider => ({
        ...provider,
        evidence: evidence.filter(item => item.providerId === provider.providerId),
      })),
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
