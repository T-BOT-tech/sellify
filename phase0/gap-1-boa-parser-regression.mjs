import assert from 'node:assert/strict';
import { boaProvider } from '../backend/lib/payments/providers/boa.js';

const receiptText = `TRANSACTION
Reference: FT25262BRVCQ
Business Date: 20250919
Amount: 300,000.00 ETB
Processing Status: Complete
DETAILS
From ABYSETAA
To CBETETAA
50 Ordering Customer /ETB1201000040001
BANK OF ABYSSINIA S.C
59 Beneficiary Customer /1000586364824
ETHIOPIAN CAPITAL MARKET AUTHORITY`;

const parsed = await boaProvider.parseEvidence({ payload: receiptText });
assert.equal(parsed.providerId, 'boa');
assert.equal(parsed.reference, 'FT25262BRVCQ');
assert.equal(parsed.amountMinor, 30000000);
assert.equal(parsed.currency, 'ETB');

const structured = await boaProvider.parseEvidence({
  payload: {
    transactionId: 'BOA-123',
    reference: 'INV-42',
    amount: '1250.50',
    currency: 'ETB',
    debitAccount: '10001',
    beneficiaryAccount: '20002',
    status: 'COMPLETED'
  }
});
assert.equal(structured.providerTransactionId, 'BOA-123');
assert.equal(structured.reference, 'INV-42');
assert.equal(structured.amountMinor, 125050);

await assert.rejects(
  () => boaProvider.parseEvidence({ payload: { amount: '100' } }),
  error => error.code === 'REFERENCE_UNAVAILABLE'
);

await assert.rejects(
  () => boaProvider.verify(),
  error => error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
);

console.log('BoA parser regression passed');
