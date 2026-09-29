import assert from 'node:assert/strict';
import { telebirrProvider } from '../backend/lib/payments/providers/telebirr.js';

const valid = await telebirrProvider.parseEvidence({ payload: {
  reference: 'TB-REF-001', transactionId: 'TB-TX-001',
  senderName: 'Customer', senderPhone: '0911000000',
  receiverName: 'Merchant', merchantAccount: '100001',
  amount: 1250, currency: 'ETB', transactionTime: '2026-09-30T10:00:00Z'
}});
assert.equal(valid.providerId, 'telebirr');
assert.equal(valid.reference, 'TB-REF-001');
assert.equal(valid.providerTransactionId, 'TB-TX-001');
assert.equal(valid.amountMinor, 1250);
assert.equal(valid.currency, 'ETB');

await assert.rejects(
  () => telebirrProvider.parseEvidence({ payload: { amount: 1250, currency: 'ETB' } }),
  error => error.code === 'REFERENCE_UNAVAILABLE'
);

await assert.rejects(
  () => telebirrProvider.parseEvidence({ payload: null }),
  error => error.code === 'INVALID_EVIDENCE'
);

const duplicateLike = await telebirrProvider.parseEvidence({ payload: {
  reference: 'TB-REF-001', transactionId: 'TB-TX-001', amount: 1250, currency: 'ETB'
}});
assert.equal(duplicateLike.providerTransactionId, valid.providerTransactionId);
assert.equal(duplicateLike.reference, valid.reference);

await assert.rejects(
  () => telebirrProvider.verify(),
  error => error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
);

console.log('Telebirr parser regression passed');
