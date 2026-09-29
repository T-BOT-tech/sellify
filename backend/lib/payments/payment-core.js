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