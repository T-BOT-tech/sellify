import crypto from 'node:crypto';
import { InvariantGate } from './invariant-gate.js';
import { PaymentDecisionEngine } from './decision-engine.js';
import { requirePaymentProvider } from './provider-registry.js';
import { resolveVerificationPolicy, requiresIndependentConfirmation } from './verification-policy.js';

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
    this.providerRegistry = providerRegistry || { requirePaymentProvider };
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

  async #observeProviderConfirmation({ chatId, evidence, paymentIntent, payment, paymentAccount, actor = null }) {
    const confirmationAttempt = await this.store.createPaymentConfirmationAttempt(chatId, {
      paymentId: payment.id,
      paymentIntentId: paymentIntent.id,
      evidenceId: evidence.id,
      paymentAccountId: paymentAccount?.id || paymentIntent.paymentAccountId || null,
      providerId: evidence.providerId,
    }, actor);

    const provider = this.providerRegistry.requirePaymentProvider(evidence.providerId);
    let providerStatus;
    try {
      providerStatus = await provider.getStatus({
        evidence,
        paymentIntent,
        payment,
        paymentAccount,
        confirmationAttempt,
        config: {
          ...(paymentAccount?.metadata || {}),
          accountIdentifier: paymentAccount?.accountIdentifier || null,
        },
        now: this.clock(),
      });
    } catch (error) {
      if (error?.code === 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED' ||
          error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        providerStatus = {
          providerId: evidence.providerId,
          status: 'UNKNOWN',
          reasonCodes: ['PROVIDER_STATUS_UNAVAILABLE'],
          rawResult: { source: evidence.source || 'payment-evidence' },
          verifier: 'payment-core',
          verifierVersion: 'provider-status-v1',
        };
      } else {
        await this.store.updatePaymentConfirmationAttempt(chatId, confirmationAttempt.id, {
          status: 'FAILED',
          reasonCodes: [error?.code || 'PROVIDER_STATUS_ERROR'],
          observation: { message: String(error?.message || 'Provider status request failed') },
          observedAt: this.clock().toISOString(),
        }, actor);
        throw error;
      }
    }

    const status = String(providerStatus?.status || 'UNKNOWN').toUpperCase();
    const attemptStatus = ({
      CONFIRMED: 'CONFIRMED',
      PENDING: 'PENDING',
      NOT_FOUND: 'NOT_FOUND',
      FAILED: 'FAILED',
      EXPIRED: 'EXPIRED',
      UNKNOWN: 'UNKNOWN',
    })[status] || 'UNKNOWN';

    const updatedAttempt = await this.store.updatePaymentConfirmationAttempt(chatId, confirmationAttempt.id, {
      status: attemptStatus,
      providerTransactionId: providerStatus?.providerTransactionId || null,
      reasonCodes: Array.isArray(providerStatus?.reasonCodes) ? providerStatus.reasonCodes : [],
      observation: providerStatus || {},
      observedAt: this.clock().toISOString(),
    }, actor);

    return {
      status: attemptStatus,
      providerStatus,
      confirmationAttempt: updatedAttempt,
    };
  }

  async recordProviderConfirmationObservation(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    const attemptId = String(command.confirmationAttemptId || command.confirmation_attempt_id || '').trim();
    const providerIdInput = String(command.providerId || '').trim().toLowerCase();
    const providerTransactionId = String(command.providerTransactionId || command.provider_transaction_id || '').trim();
    if (!chatId || (!attemptId && !providerTransactionId) || !providerIdInput) {
      throw Object.assign(new Error('chatId, providerId, and confirmationAttemptId or providerTransactionId are required'), { statusCode: 400, code: 'CONFIRMATION_OBSERVATION_CONTEXT_REQUIRED' });
    }

    let correlationChatId = chatId;
    let resolvedPaymentAccount = null;

    if (!attemptId && providerTransactionId) {
      const providerAccountReference = String(
        command.providerAccountReference ||
        command.provider_account_reference ||
        command.accountIdentifier ||
        command.account_identifier ||
        ''
      ).trim();

      if (!providerAccountReference) {
        throw Object.assign(
          new Error('providerAccountReference is required for provider transaction correlation'),
          { statusCode: 400, code: 'PAYMENT_ACCOUNT_REFERENCE_REQUIRED' }
        );
      }

      if (typeof this.store.getPaymentAccountForProviderNotification !== 'function') {
        throw Object.assign(
          new Error('Canonical payment-account notification resolver is unavailable'),
          { statusCode: 503, code: 'PAYMENT_ACCOUNT_RESOLVER_UNAVAILABLE' }
        );
      }

      resolvedPaymentAccount = await this.store.getPaymentAccountForProviderNotification(
        providerIdInput,
        providerAccountReference
      );

      if (!resolvedPaymentAccount?.id || !resolvedPaymentAccount?.chatId) {
        throw Object.assign(
          new Error('Provider notification payment account could not be resolved'),
          { statusCode: 404, code: 'PAYMENT_ACCOUNT_NOT_FOUND' }
        );
      }

      if (resolvedPaymentAccount.providerId &&
          String(resolvedPaymentAccount.providerId).toLowerCase() !== providerIdInput) {
        throw Object.assign(
          new Error('Provider notification payment account provider mismatch'),
          { statusCode: 409, code: 'PAYMENT_ACCOUNT_PROVIDER_MISMATCH' }
        );
      }

      correlationChatId = String(resolvedPaymentAccount.chatId);
    }

    const attempt = attemptId
      ? await this.store.getPaymentConfirmationAttempt(correlationChatId, attemptId)
      : await this.store.getPaymentConfirmationAttemptByProviderTransaction(correlationChatId, {
          providerId: providerIdInput,
          providerTransactionId,
          paymentAccountId: resolvedPaymentAccount?.id || null,
        });
    if (!attempt) throw Object.assign(new Error('Confirmation attempt not found'), { statusCode: 404, code: 'CONFIRMATION_ATTEMPT_NOT_FOUND' });
    const evidence = await this.store.getPaymentEvidence(chatId, attempt.evidenceId);
    if (!evidence) throw Object.assign(new Error('Confirmation evidence not found'), { statusCode: 409, code: 'EVIDENCE_NOT_FOUND' });

    const providerId = providerIdInput;
    if (providerId !== String(attempt.providerId || '').trim().toLowerCase() ||
        providerId !== String(evidence.providerId || '').trim().toLowerCase()) {
      throw Object.assign(new Error('Confirmation observation provider mismatch'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
    }

    const status = String(command.status || 'UNKNOWN').toUpperCase();
    if (!['CONFIRMED', 'PENDING', 'NOT_FOUND', 'FAILED', 'EXPIRED', 'UNKNOWN'].includes(status)) {
      throw Object.assign(new Error('Unsupported confirmation observation status'), { statusCode: 400, code: 'CONFIRMATION_STATUS_INVALID' });
    }

    const observation = command.observation && typeof command.observation === 'object'
      ? command.observation
      : {};
    const updated = await this.store.updatePaymentConfirmationAttempt(chatId, attempt.id, {
      status,
      providerTransactionId: providerTransactionId || observation.providerTransactionId || null,
      reasonCodes: Array.isArray(command.reasonCodes) ? command.reasonCodes : (Array.isArray(observation.reasonCodes) ? observation.reasonCodes : []),
      observation: {
        ...observation,
        providerId,
        status,
        source: command.source || 'provider-callback',
      },
      observedAt: command.observedAt || this.clock().toISOString(),
    }, command.actor || null);

    if (status === 'CONFIRMED') {
      return this.finalizeProviderConfirmation({
        chatId,
        confirmationAttemptId: updated.id,
        actor: command.actor || null,
      });
    }

    return {
      outcome: 'PENDING_CONFIRMATION',
      payment: await this.store.getPaymentForIntent(chatId, attempt.paymentIntentId),
      evidence,
      confirmationAttempt: updated,
      pending: true,
    };
  }

  async observeProviderConfirmation(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    const evidenceId = String(command.evidenceId || command.evidence_id || '').trim();
    if (!chatId || !evidenceId) {
      throw Object.assign(new Error('chatId and evidenceId are required'), { statusCode: 400, code: 'CONFIRMATION_OBSERVATION_CONTEXT_REQUIRED' });
    }

    const evidence = await this.store.getPaymentEvidence(chatId, evidenceId);
    if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });
    const paymentIntent = evidence.paymentIntentId ? await this.store.getPaymentIntent(chatId, evidence.paymentIntentId) : null;
    const payment = evidence.paymentIntentId ? await this.store.getPaymentForIntent(chatId, evidence.paymentIntentId) : null;
    const paymentAccount = paymentIntent?.paymentAccountId
      ? await this.store.getPaymentAccountById(chatId, paymentIntent.paymentAccountId)
      : null;
    if (!paymentIntent || !payment) throw Object.assign(new Error('Payment intent/payment could not be resolved for evidence'), { statusCode: 409, code: 'PAYMENT_INTENT_MISMATCH' });

    const result = await this.#observeProviderConfirmation({
      chatId,
      evidence,
      paymentIntent,
      payment,
      paymentAccount,
      actor: command.actor || null,
    });

    if (result.status === 'CONFIRMED') {
      return this.finalizeProviderConfirmation({
        chatId,
        confirmationAttemptId: result.confirmationAttempt.id,
        actor: command.actor || null,
      });
    }

    return {
      outcome: 'PENDING_CONFIRMATION',
      payment,
      evidence,
      confirmationAttempt: result.confirmationAttempt,
      providerStatus: result.providerStatus,
      pending: true,
    };
  }

  async verifyEvidence(command = {}) {
    this.#authorize(command, 'payments:accept');
    const evidenceId = String(command.evidenceId || command.evidence_id || '').trim();
    const chatId = String(command.chatId || '').trim();
    if (!chatId || !evidenceId) {
      throw Object.assign(new Error('chatId and evidenceId are required'), { statusCode: 400, code: 'PAYMENT_VERIFICATION_CONTEXT_REQUIRED' });
    }

    const actorOrganizationId = String(command.actor?.organizationId || '').trim();
    const actorLocationId = String(command.actor?.locationId || '').trim();
    const commandOrganizationId = String(command.organizationId || '').trim();
    const commandLocationId = String(command.locationId || '').trim();
    if (commandOrganizationId && actorOrganizationId && commandOrganizationId !== actorOrganizationId) {
      throw Object.assign(new Error('Payment verification organization context mismatch'), { statusCode: 403, code: 'TENANT_SCOPE_DENIED' });
    }
    if (commandLocationId && actorLocationId && commandLocationId !== actorLocationId) {
      throw Object.assign(new Error('Payment verification location context mismatch'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
    }

    const evidence = await this.store.getPaymentEvidence(chatId, evidenceId);
    if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });
    if (!evidence.paymentIntentId) {
      return { outcome: 'UNMATCHED', evidence, verification: null, decision: null };
    }

    if (commandOrganizationId && String(evidence.organizationId || '') !== commandOrganizationId) {
      throw Object.assign(new Error('Evidence is outside the requested organization scope'), { statusCode: 403, code: 'TENANT_SCOPE_DENIED' });
    }
    if (commandLocationId && String(evidence.locationId || '') !== commandLocationId) {
      throw Object.assign(new Error('Evidence is outside the requested location scope'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
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
    const provider = this.providerRegistry.requirePaymentProvider(evidence.providerId);
    const verificationPolicy = resolveVerificationPolicy({ paymentAccount, paymentIntent, provider });

    let providerVerification;
    try {
      providerVerification = await provider.verify({
        evidence,
        paymentIntent,
        payment,
        paymentAccount,
        config: {
          ...(paymentAccount?.metadata || {}),
          accountIdentifier: paymentAccount?.accountIdentifier || null,
        },
        now: this.clock(),
      });
    } catch (error) {
      if (error?.code === 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED' ||
          error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        providerVerification = {
          providerId: evidence.providerId,
          result: 'UNVERIFIABLE',
          confidence: 0,
          observedAmountMinor: Number.isInteger(normalized.amountMinor) ? normalized.amountMinor : null,
          observedCurrency: normalized.currency || null,
          observedReceiver: normalized.receiver || null,
          observedReceiverAccount: normalized.receiver || null,
          observedReference: normalized.merchantReference || normalized.externalReference || evidence.externalReference || null,
          observedTransactionId: normalized.providerTransactionId || evidence.providerTransactionId || null,
          observedAt: normalized.providerTimestamp || evidence.observedAt || null,
          reasonCodes: ['PROVIDER_VERIFICATION_UNAVAILABLE'],
          rawResult: { source: evidence.source, normalizedPayload: normalized },
          verifier: 'payment-core',
          verifierVersion: 'provider-verification-v1',
        };
      } else {
        throw error;
      }
    }

    const verification = {
      ...providerVerification,
      providerId: providerVerification?.providerId || evidence.providerId,
      reasonCodes: Array.isArray(providerVerification?.reasonCodes) ? providerVerification.reasonCodes : [],
      rawResult: {
        ...(providerVerification?.rawResult || { source: evidence.source, normalizedPayload: normalized }),
        verificationPolicy: verificationPolicy.mode,
        independentConfirmationRequired: verificationPolicy.requireIndependentConfirmation,
      },
      verifier: providerVerification?.verifier || 'payment-core',
      verifierVersion: providerVerification?.verifierVersion || 'provider-verification-v1',
    };

    if (requiresIndependentConfirmation(verificationPolicy)) {
      const confirmation = await this.#observeProviderConfirmation({
        chatId,
        evidence,
        paymentIntent,
        payment,
        paymentAccount,
        actor: command.actor || null,
      });

      verification.rawResult = {
        ...verification.rawResult,
        independentConfirmation: confirmation.providerStatus,
        confirmationAttempt: confirmation.confirmationAttempt,
      };

      if (confirmation.status !== 'CONFIRMED') {
        verification.result = confirmation.status === 'PENDING' ? 'PENDING' : 'UNVERIFIABLE';
        verification.confidence = 0;
        verification.reasonCodes = [
          ...new Set([
            ...verification.reasonCodes,
            ...(Array.isArray(confirmation.providerStatus?.reasonCodes) ? confirmation.providerStatus.reasonCodes : []),
            confirmation.status === 'UNKNOWN'
              ? 'INDEPENDENT_CONFIRMATION_UNAVAILABLE'
              : 'INDEPENDENT_CONFIRMATION_REQUIRED',
          ]),
        ];
        return {
          outcome: 'PENDING_CONFIRMATION',
          payment,
          evidence,
          verification,
          confirmationAttempt: confirmation.confirmationAttempt,
          invariants: null,
          decision: null,
          pending: true,
        };
      }

      return this.finalizeProviderConfirmation({
        chatId,
        confirmationAttemptId: confirmation.confirmationAttempt.id,
        actor: command.actor || null,
      });
    }

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
      const uniqueConstraint = String(error?.message || '').includes('UNIQUE constraint failed');
      if (error?.code !== 'PAYMENT_STATE_CONFLICT' && !uniqueConstraint) throw error;
      const concurrentVerification = await this.store.getPaymentVerificationForEvidence(chatId, evidence.id);
      if (!concurrentVerification) throw error;
      const concurrentDecision = concurrentVerification
        ? await this.store.getPaymentDecisionForVerification(chatId, concurrentVerification.id)
        : null;
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

  async finalizeProviderConfirmation(command = {}) {
    this.#authorize(command, 'payments:accept');
    const chatId = String(command.chatId || '').trim();
    const attemptId = String(command.confirmationAttemptId || command.confirmation_attempt_id || '').trim();
    if (!chatId || !attemptId) {
      throw Object.assign(new Error('chatId and confirmationAttemptId are required'), { statusCode: 400, code: 'CONFIRMATION_FINALIZATION_CONTEXT_REQUIRED' });
    }

    const attempt = await this.store.getPaymentConfirmationAttempt(chatId, attemptId);
    if (!attempt) throw Object.assign(new Error('Confirmation attempt not found'), { statusCode: 404, code: 'CONFIRMATION_ATTEMPT_NOT_FOUND' });
    if (attempt.status !== 'CONFIRMED') {
      return { outcome: 'PENDING_CONFIRMATION', confirmationAttempt: attempt, pending: true };
    }

    const evidence = await this.store.getPaymentEvidence(chatId, attempt.evidenceId);
    const paymentIntent = evidence?.paymentIntentId ? await this.store.getPaymentIntent(chatId, evidence.paymentIntentId) : null;
    const payment = evidence?.paymentIntentId ? await this.store.getPaymentForIntent(chatId, evidence.paymentIntentId) : null;
    const paymentAccount = paymentIntent?.paymentAccountId
      ? await this.store.getPaymentAccountById(chatId, paymentIntent.paymentAccountId)
      : null;
    if (!evidence || !paymentIntent || !payment) {
      throw Object.assign(new Error('Confirmation context could not be resolved'), { statusCode: 409, code: 'PAYMENT_INTENT_MISMATCH' });
    }
    if (String(attempt.providerId).toLowerCase() !== String(evidence.providerId).toLowerCase() ||
        String(paymentIntent.providerId).toLowerCase() !== String(evidence.providerId).toLowerCase()) {
      throw Object.assign(new Error('Confirmation provider mismatch'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
    }
    if (attempt.paymentAccountId && String(attempt.paymentAccountId) !== String(paymentIntent.paymentAccountId || '')) {
      throw Object.assign(new Error('Confirmation payment account mismatch'), { statusCode: 409, code: 'PAYMENT_ACCOUNT_BINDING_MISMATCH' });
    }

    const observation = attempt.observation || {};
    const verification = {
      providerId: evidence.providerId,
      result: 'MATCH',
      confidence: 1,
      observedAmountMinor: Number.isInteger(observation.observedAmountMinor)
        ? observation.observedAmountMinor
        : (Number.isInteger(observation.amountMinor) ? observation.amountMinor : null),
      observedCurrency: observation.observedCurrency || observation.currency || null,
      observedReceiver: observation.observedReceiver || observation.receiver || null,
      observedReceiverAccount: observation.observedReceiverAccount || observation.receiverAccount || observation.receiver || null,
      observedReference: observation.observedReference || observation.merchantReference || observation.externalReference || evidence.externalReference || null,
      observedTransactionId: observation.providerTransactionId || attempt.providerTransactionId || evidence.providerTransactionId || null,
      observedAt: attempt.observedAt || observation.observedAt || evidence.observedAt || null,
      reasonCodes: Array.isArray(observation.reasonCodes) ? observation.reasonCodes : [],
      rawResult: {
        source: evidence.source || 'payment-evidence',
        independentConfirmation: observation,
        confirmationAttemptId: attempt.id,
      },
      verifier: observation.verifier || 'payment-core',
      verifierVersion: observation.verifierVersion || 'provider-status-finalization-v1',
    };

    if (observation.providerId &&
        String(observation.providerId).toLowerCase() !== String(evidence.providerId).toLowerCase()) {
      verification.result = 'MISMATCH';
      verification.reasonCodes = [...new Set([...verification.reasonCodes, 'PROVIDER_MISMATCH'])];
    }
    if (attempt.providerTransactionId &&
        evidence.providerTransactionId &&
        String(attempt.providerTransactionId) !== String(evidence.providerTransactionId)) {
      verification.result = 'MISMATCH';
      verification.reasonCodes = [...new Set([...verification.reasonCodes, 'PROVIDER_TRANSACTION_MISMATCH'])];
    }

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
          reason: decision.reasonCodes.join(',') || 'Independent provider confirmation decision',
          entryType: decision.targetState || payment.state,
          metadata: { evidenceId: evidence.id, verificationId, decisionId, confirmationAttemptId: attempt.id },
        },
      }, command.actor || null);
    } catch (error) {
      const uniqueConstraint = String(error?.message || '').includes('UNIQUE constraint failed');
      if (error?.code !== 'PAYMENT_STATE_CONFLICT' && !uniqueConstraint) throw error;
      const concurrentVerification = await this.store.getPaymentVerificationForEvidence(chatId, evidence.id);
      if (!concurrentVerification) throw error;
      const concurrentDecision = await this.store.getPaymentDecisionForVerification(chatId, concurrentVerification.id);
      committedPayment = await this.store.getPayment(chatId, payment.id);
      return {
        outcome: concurrentDecision?.targetState || concurrentVerification.result,
        payment: committedPayment,
        evidence,
        confirmationAttempt: attempt,
        verification: concurrentVerification,
        invariants: concurrentDecision?.invariantResults || invariants,
        decision: concurrentDecision,
        idempotent: true,
        concurrent: true,
      };
    }

    return {
      outcome: decision.targetState || 'NO_STATE_CHANGE',
      payment: committedPayment,
      evidence,
      confirmationAttempt: attempt,
      verification: await this.store.getPaymentVerification(chatId, verificationId),
      invariants,
      decision: await this.store.getPaymentDecision(chatId, decisionId),
    };
  }

  async getProviderStatus(command = {}) {
    this.#authorize(command, 'payments:accept');
    const evidenceId = String(command.evidenceId || command.evidence_id || '').trim();
    const chatId = String(command.chatId || '').trim();
    if (!chatId || !evidenceId) {
      throw Object.assign(new Error('chatId and evidenceId are required'), { statusCode: 400, code: 'PAYMENT_STATUS_CONTEXT_REQUIRED' });
    }

    const evidence = await this.store.getPaymentEvidence(chatId, evidenceId);
    if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });

    const paymentIntent = evidence.paymentIntentId
      ? await this.store.getPaymentIntent(chatId, evidence.paymentIntentId)
      : null;
    const payment = evidence.paymentIntentId
      ? await this.store.getPaymentForIntent(chatId, evidence.paymentIntentId)
      : null;
    const paymentAccount = paymentIntent?.paymentAccountId
      ? await this.store.getPaymentAccountById(chatId, paymentIntent.paymentAccountId)
      : null;

    if (!paymentIntent || !payment) {
      throw Object.assign(new Error('Payment intent/payment could not be resolved for provider status'), { statusCode: 409, code: 'PAYMENT_INTENT_MISMATCH' });
    }
    if (String(evidence.providerId || '').toLowerCase() !== String(paymentIntent.providerId || '').toLowerCase()) {
      throw Object.assign(new Error('Evidence provider does not match payment intent provider'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
    }

    const provider = this.providerRegistry.requirePaymentProvider(evidence.providerId);
    try {
      return await provider.getStatus({
        evidence,
        paymentIntent,
        payment,
        paymentAccount,
        config: {
          ...(paymentAccount?.metadata || {}),
          accountIdentifier: paymentAccount?.accountIdentifier || null,
        },
        now: this.clock(),
      });
    } catch (error) {
      if (error?.code === 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED' ||
          error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        return {
          providerId: evidence.providerId,
          status: 'UNKNOWN',
          reasonCodes: ['PROVIDER_STATUS_UNAVAILABLE'],
          rawResult: { source: evidence.source || 'payment-evidence' },
          verifier: 'payment-core',
          verifierVersion: 'provider-status-v1',
        };
      }
      throw error;
    }
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