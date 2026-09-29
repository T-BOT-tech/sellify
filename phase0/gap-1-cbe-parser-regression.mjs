import assert from 'node:assert/strict';
import { cbeProvider } from '../backend/lib/payments/providers/cbe.js';

const pdfText = `Commercial Bank of Ethiopia
Payment / Transaction Information
Payer Mr Mohammed Abdulwasi Reshid
Account 1****1685
Receiver SAMI ADIL ZEKARIA
Account 1****6171
Transferred Amount 20,000.00 ETB
Payment Date & Time 5/20/2026, 7:29:00 PM
Reference No. (VAT Invoice No) FT26140P01YB`;

const parsedPdf = await cbeProvider.parseEvidence({ payload: pdfText });
assert.equal(parsedPdf.providerId, 'cbe');
assert.equal(parsedPdf.reference, 'FT26140P01YB');
assert.equal(parsedPdf.amountMinor, 2000000);
assert.equal(parsedPdf.currency, 'ETB');
assert.equal(parsedPdf.senderAccount, '1****1685');
assert.equal(parsedPdf.receiverAccount, '1****6171');

const parsedJson = await cbeProvider.parseEvidence({ payload: {
  id: 'fHCxyV4mg5p',
  debitAccountHolder: 'Mr Mohammed Abdulwasi Reshid',
  creditAccountHolder: 'SAMI ADIL ZEKARIA',
  debitAccountNo: '1****1685',
  creditAccountNo: '1****6171',
  amountCredited: '20000.00',
  creditCurrency: 'ETB',
  dateTimes: ['2026-05-20T19:29:00'],
}});
assert.equal(parsedJson.reference, 'fHCxyV4mg5p');
assert.equal(parsedJson.providerTransactionId, 'fHCxyV4mg5p');
assert.equal(parsedJson.amountMinor, 2000000);

await assert.rejects(
  () => cbeProvider.parseEvidence({ payload: { amountCredited: '20000.00', creditCurrency: 'ETB' } }),
  error => error.code === 'REFERENCE_UNAVAILABLE'
);

await assert.rejects(
  () => cbeProvider.verify(),
  error => error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
);

console.log('CBE parser regression passed');
