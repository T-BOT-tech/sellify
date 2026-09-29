import assert from 'node:assert/strict';
import { mpesaProvider } from '../backend/lib/payments/providers/mpesa.js';

const callback = {
  TransID: 'LHG31AA5TX',
  TransTime: '20260930153000',
  TransAmount: '1500',
  BusinessShortCode: '174379',
  BillRefNumber: 'ORDER-42',
  MSISDN: '251911000000',
  FirstName: 'John',
  LastName: 'Doe',
};
const parsed = await mpesaProvider.parseEvidence({ payload: callback });
assert.equal(parsed.providerId, 'mpesa');
assert.equal(parsed.providerTransactionId, 'LHG31AA5TX');
assert.equal(parsed.reference, 'ORDER-42');
assert.equal(parsed.amountMinor, 150000);
assert.equal(parsed.currency, 'KES');
assert.equal(parsed.receiverAccount, '174379');

const statusCallback = {
  Result: {
    ResultCode: 0,
    TransactionID: 'MBN31H462N',
    ResultParameters: {
      ResultParameter: [
        { Key: 'Amount', Value: '300' },
        { Key: 'ReceiptNo', Value: 'MBN31H462N' },
        { Key: 'TransactionCompletedTime', Value: '20171206163233' },
      ],
    },
  },
};
const parsedStatus = await mpesaProvider.parseEvidence({ payload: statusCallback });
assert.equal(parsedStatus.providerTransactionId, 'MBN31H462N');
assert.equal(parsedStatus.amountMinor, 30000);

await assert.rejects(
  () => mpesaProvider.parseEvidence({ payload: { TransAmount: '100' } }),
  error => error.code === 'REFERENCE_UNAVAILABLE'
);

await assert.rejects(
  () => mpesaProvider.getStatus(),
  error => error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
);

console.log('M-Pesa parser regression passed');
