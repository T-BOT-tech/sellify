import assert from 'node:assert/strict';
import test from 'node:test';
import { InvariantGate } from '../backend/lib/payments/invariant-gate.js';
import { PaymentDecisionEngine } from '../backend/lib/payments/decision-engine.js';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const base = {
  payment: {
    id: 'pay-1',
    organizationId: 'org-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: null,
  },
  paymentIntent: {
    id: 'intent-1',
    organizationId: 'org-1',
    providerId: 'telebirr',
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
  paymentAccount: {
    id: 'account-1',
    organizationId: 'org-1',
    providerId: 'telebirr',
    accountIdentifier: '251900000000',
  },
  evidence: {
    id: 'evidence-1',
    organizationId: 'org-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    status: 'RECEIVED',
  },
  verification: {
    result: 'MATCH',
    providerId: 'telebirr',
    observedAmountMinor: 150000,
    observedCurrency: 'ETB',
    observedReceiverAccount: '251900000000',
    reasonCodes: [],
  },
};

test('InvariantGate accepts a structurally matching verification', () => {
  const result = new InvariantGate().evaluate(base);
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasonCodes, []);
});

test('InvariantGate rejects provider mismatch', () => {
  const input = structuredClone(base);
  input.verification.providerId = 'mpesa';
  const result = new InvariantGate().evaluate(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasonCodes.includes('PROVIDER_MISMATCH'));
});

test('InvariantGate rejects receiver mismatch', () => {
  const input = structuredClone(base);
  input.verification.observedReceiverAccount = '251911111111';
  const result = new InvariantGate().evaluate(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasonCodes.includes('RECEIVER_MISMATCH'));
});

test('DecisionEngine accepts only when MATCH and invariants pass', () => {
  const result = new PaymentDecisionEngine().decide({
    payment: base.payment,
    verification: base.verification,
    invariants: { passed: true, reasonCodes: [] },
  });
  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.targetState, 'VERIFIED');
});

test('DecisionEngine turns duplicate provider transactions into DUPLICATE', () => {
  const result = new PaymentDecisionEngine().decide({
    payment: base.payment,
    verification: { result: 'MATCH', reasonCodes: ['PROVIDER_TRANSACTION_DUPLICATE'] },
    invariants: { passed: false, reasonCodes: ['PROVIDER_TRANSACTION_DUPLICATE'] },
  });
  assert.equal(result.decision, 'MARK_DUPLICATE');
  assert.equal(result.targetState, 'DUPLICATE');
});

test('DecisionEngine preserves a valid underpayment as PARTIAL', () => {
  const result = new PaymentDecisionEngine().decide({
    payment: { ...base.payment, amountMinor: 150000 },
    verification: { ...base.verification, observedAmountMinor: 100000 },
    invariants: { passed: false, reasonCodes: ['AMOUNT_MISMATCH'] },
  });
  assert.equal(result.decision, 'MARK_PARTIAL');
  assert.equal(result.targetState, 'PARTIAL');
  assert.ok(result.reasonCodes.includes('PARTIAL_PAYMENT'));
});

test('DecisionEngine turns provider mismatch into MISMATCH', () => {
  const result = new PaymentDecisionEngine().decide({
    payment: base.payment,
    verification: { result: 'MATCH', reasonCodes: [] },
    invariants: { passed: false, reasonCodes: ['PROVIDER_MISMATCH'] },
  });
  assert.equal(result.decision, 'MARK_MISMATCH');
  assert.equal(result.targetState, 'MISMATCH');
});

test('PaymentCore createPayment cannot accept a caller-supplied VERIFIED state', async () => {
  const calls = [];
  const core = new PaymentCore({
    store: {
      createPaymentWithIntent: async (_chatId, input) => {
        calls.push(input);
        return { payment: { state: 'UNPAID' }, intent: { status: 'OPEN' } };
      },
    },
  });
  await assert.rejects(
    core.createPayment({
      chatId: 'chat-1',
      organizationId: 'org-1',
      providerId: 'telebirr',
      paymentAccountId: 'account-1',
      amountMinor: 150000,
      currency: 'ETB',
      state: 'VERIFIED',
    }),
    error => error.code === 'STATE_NOT_CLIENT_CONTROLLED' || error.code === 'INVALID_PAYMENT_STATE'
  );
  assert.equal(calls.length, 0);
});

test('PaymentCore submitEvidence never changes payment state', async () => {
  const calls = [];
  const core = new PaymentCore({
    store: {
      insertPaymentEvidence: async (chatId, input) => {
        calls.push({ chatId, input });
        return { evidence: { status: 'RECEIVED' }, duplicate: false };
      },
    },
  });
  const result = await core.submitEvidence({
    chatId: 'chat-1',
    organizationId: 'org-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    evidenceType: 'SMS_TEXT',
    payload: { text: 'payment confirmation' },
  });
  assert.equal(result.evidence.status, 'RECEIVED');
  assert.equal(calls.length, 1);
});

test('InvariantGate identifies overpayment explicitly', () => {
  const input = structuredClone(base);
  input.verification.observedAmountMinor = 175000;
  const result = new InvariantGate().evaluate(input);
  assert.ok(result.reasonCodes.includes('OVERPAYMENT'));
  assert.ok(result.reasonCodes.includes('AMOUNT_MISMATCH'));
});

test('InvariantGate maps duplicate provider transaction to decision reason', () => {
  const input = structuredClone(base);
  input.verification.providerTransactionUnique = false;
  const result = new InvariantGate().evaluate(input);
  assert.ok(result.reasonCodes.includes('PROVIDER_TRANSACTION_DUPLICATE'));
});

test('InvariantGate maps reused reference to mismatch reason', () => {
  const input = structuredClone(base);
  input.verification.referenceUnique = false;
  const result = new InvariantGate().evaluate(input);
  assert.ok(result.reasonCodes.includes('REFERENCE_MISMATCH'));
});
