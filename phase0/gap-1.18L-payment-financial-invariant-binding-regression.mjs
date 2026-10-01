import assert from 'node:assert/strict';
import { evaluatePaymentInvariants } from '../backend/lib/payments/invariant-gate.js';
import { decidePayment } from '../backend/lib/payments/decision-engine.js';
import { readFileSync } from 'node:fs';

const base = {
  payment: {
    id: 'pay-1',
    organizationId: 'org-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    paymentAccountId: 'acct-1',
    amountMinor: 1000,
    currency: 'ETB',
    externalReference: 'SELL-1001',
  },
  paymentIntent: {
    id: 'intent-1',
    organizationId: 'org-1',
    providerId: 'telebirr',
    amountMinor: 1000,
    currency: 'ETB',
    expiresAt: null,
  },
  paymentAccount: {
    id: 'acct-1',
    organizationId: 'org-1',
    providerId: 'telebirr',
    accountIdentifier: '251911111111',
  },
  evidence: {
    id: 'evidence-1',
    paymentId: 'pay-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    providerTransactionId: 'tx-1',
    externalReference: 'SELL-1001',
    status: 'RECEIVED',
  },
  verification: {
    result: 'MATCH',
    providerId: 'telebirr',
    observedAmountMinor: 1000,
    observedCurrency: 'ETB',
    observedReceiverAccount: '251911111111',
    observedReference: 'SELL-1001',
    observedTransactionId: 'tx-1',
    observedAt: new Date().toISOString(),
    reasonCodes: [],
  },
};

const valid = evaluatePaymentInvariants(base);
assert.equal(valid.passed, true);
assert.equal(valid.reasonCodes.length, 0);

const amountMismatch = evaluatePaymentInvariants({
  ...base,
  verification: { ...base.verification, observedAmountMinor: 999 },
});
assert.ok(amountMismatch.reasonCodes.includes('AMOUNT_MATCH'));
assert.ok(amountMismatch.hardFailures.includes('AMOUNT_MISMATCH'));

const intentMismatch = evaluatePaymentInvariants({
  ...base,
  paymentIntent: { ...base.paymentIntent, amountMinor: 900 },
});
assert.ok(intentMismatch.reasonCodes.includes('AMOUNT_MISMATCH'));

const currencyMismatch = evaluatePaymentInvariants({
  ...base,
  verification: { ...base.verification, observedCurrency: 'USD' },
});
assert.ok(currencyMismatch.reasonCodes.includes('CURRENCY_MATCH'));

const receiverMismatch = evaluatePaymentInvariants({
  ...base,
  verification: { ...base.verification, observedReceiverAccount: '251922222222' },
});
assert.ok(receiverMismatch.reasonCodes.includes('RECEIVER_MATCH'));

const referenceMismatch = evaluatePaymentInvariants({
  ...base,
  verification: { ...base.verification, observedReference: 'SELL-OTHER' },
});
assert.ok(referenceMismatch.reasonCodes.includes('REFERENCE_MATCH'));

const transactionMissing = evaluatePaymentInvariants({
  ...base,
  verification: { ...base.verification, observedTransactionId: null },
});
assert.ok(transactionMissing.reasonCodes.includes('TRANSACTION_ID_PRESENT'));
assert.ok(transactionMissing.hardFailures.includes('TRANSACTION_ID_MISSING'));

const transactionUnbound = evaluatePaymentInvariants({
  ...base,
  evidence: { ...base.evidence, providerTransactionId: 'tx-other' },
});
assert.ok(transactionUnbound.reasonCodes.includes('TRANSACTION_MISMATCH'));

const decision = decidePayment({
  payment: base.payment,
  verification: { ...base.verification, result: 'MATCH' },
  invariants: transactionMissing,
});
assert.equal(decision.decision, 'MARK_MISMATCH');
assert.equal(decision.targetState, 'MISMATCH');

const store = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(store, /VERIFICATION_AMOUNT_MISMATCH/);
assert.match(store, /VERIFICATION_CURRENCY_MISMATCH/);
assert.match(store, /VERIFICATION_RECEIVER_MISMATCH/);
assert.match(store, /VERIFICATION_REFERENCE_MISMATCH/);
assert.match(store, /VERIFICATION_TRANSACTION_MISMATCH/);
assert.match(store, /PROVIDER_TRANSACTION_DUPLICATE/);
assert.match(store, /observed_transaction_id = ?/);

console.log('GAP-1.18L payment financial invariant binding regression passed');
