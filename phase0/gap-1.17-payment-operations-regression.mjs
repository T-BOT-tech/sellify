import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

function makeStore() {
  const actions = new Map();
  const payment = { id: 'pay-117', organizationId: 'org-117', state: 'UNPAID', providerId: 'test-provider', paymentIntentId: 'intent-117', paymentAccountId: 'acct-117', amountMinor: 1000, currency: 'ETB' };
  return {
    async getPayment() { return payment; },
    async getPaymentIntent() { return { id: 'intent-117', paymentId: payment.id }; },
    async listPaymentAccounts() { return [{ id: 'acct-117', providerId: 'test-provider', status: 'active' }]; },
    async insertPaymentEvidence() { return { evidence: { id: 'evidence-117' }, duplicate: false }; },
    async insertPaymentVerification() { return { id: 'verification-117' }; },
    async insertPaymentDecision() { return { id: 'decision-117' }; },
    async commitPaymentDecision() { return { payment, decision: { targetState: payment.state } }; },
    async recordPaymentReconciliation() { return { id: 'recon-117' }; },
    async listPaymentReconciliations() { return []; },
    async createPaymentOperationalAction(chatId, input, actor) {
      const key = input.idempotencyKey || input.idempotency_key || null;
      if (key) {
        for (const a of actions.values()) if (a.idempotencyKey === key) return { action: a, duplicate: true };
      }
      const action = {
        id: 'op-' + (actions.size + 1), organizationId: payment.organizationId, paymentId: payment.id,
        actionType: String(input.actionType || input.action_type).toUpperCase(),
        operation: String(input.operation).toUpperCase(), status: 'REQUESTED', attempt: 1,
        idempotencyKey: key, reason: input.reason || '', actorId: actor?.userId || null,
      };
      actions.set(action.id, action);
      return { action, duplicate: false };
    },
    async updatePaymentOperationalAction(chatId, id, patch) {
      const action = actions.get(id); assert.ok(action);
      Object.assign(action, patch);
      return action;
    },
    async listPaymentOperationalActions() { return [...actions.values()]; },
  };
}

function makeCore(store) {
  return new PaymentCore({
    store,
    providerRegistry: {
      getPaymentProvider() {
        return {
          id: 'test-provider',
          capabilities: { getStatus: true },
          async getStatus() { return { status: 'PENDING', amountMinor: 1000, currency: 'ETB', reference: 'ref-117' }; },
        };
      },
    },
  });
}

test('GAP-1.17 records operational actions idempotently and supports manual review resolution', async () => {
  const store = makeStore();
  const core = makeCore(store);
  const actor = { userId: 'user-117', role: 'owner' };
  const first = await core.recordOperationalAction({
    chatId: 'chat-117', paymentId: 'pay-117', organizationId: 'org-117',
    actionType: 'MANUAL_REVIEW', operation: 'REFUND_REVIEW', reason: 'Provider returned UNKNOWN',
    idempotencyKey: 'review-117', actor,
  });
  assert.equal(first.duplicate, false);
  const duplicate = await core.recordOperationalAction({
    chatId: 'chat-117', paymentId: 'pay-117', organizationId: 'org-117',
    actionType: 'MANUAL_REVIEW', operation: 'REFUND_REVIEW', idempotencyKey: 'review-117', actor,
  });
  assert.equal(duplicate.duplicate, true);
  const resolved = await core.resolveManualReview({
    chatId: 'chat-117', paymentId: 'pay-117', organizationId: 'org-117',
    actionId: first.action.id, status: 'RESOLVED', reason: 'Reviewed provider evidence', actor,
  });
  assert.equal(resolved.action.status, 'RESOLVED');
});

test('GAP-1.17 blocks financial mutation retries and permits safe status-query recovery', async () => {
  const store = makeStore();
  const core = makeCore(store);
  const actor = { userId: 'user-117', role: 'owner' };
  const blocked = await core.retryOperationalAction({
    chatId: 'chat-117', paymentId: 'pay-117', organizationId: 'org-117',
    actionType: 'REFUND', idempotencyKey: 'retry-refund-117', actor,
  });
  assert.equal(blocked.status, 'BLOCKED');
  assert.deepEqual(blocked.reasonCodes, ['MANUAL_REVIEW_REQUIRED']);

  const retried = await core.retryOperationalAction({
    chatId: 'chat-117', paymentId: 'pay-117', organizationId: 'org-117',
    actionType: 'STATUS_QUERY', idempotencyKey: 'retry-status-117', actor,
  });
  assert.equal(retried.status, 'SUCCEEDED');
  assert.equal(retried.action.status, 'SUCCEEDED');
});

console.log('GAP-1.17 payment operational regression passed');
