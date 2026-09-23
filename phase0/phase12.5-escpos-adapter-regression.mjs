import assert from 'node:assert/strict';
import {
  createReceiptPrintJob,
} from '../app/src/printing/contract.js';
import {
  ESC_POS_ADAPTER_ID,
  getEscPosAdapterMetadata,
  encodeEscPosPrintJob,
} from '../app/src/printing/escpos-adapter.js';
import { escposEncodeReceipt } from '../app/src/printing/escpos.js';

const document = {
  store: 'SELLIFY',
  header: 'RECEIPT',
  date: '2026-09-07T20:00:00Z',
  customer: { name: 'Aster' },
  items: [{ qty: 2, name: 'Coffee', amount: '100.00' }],
  total: '100.00',
  cashTendered: '200.00',
  changeDue: '100.00',
  footer: 'Thank you',
};

const job = createReceiptPrintJob({
  orderId: 'ORDER-12-5',
  document,
  copies: 2,
  metadata: { fulfillmentType: 'pickup' },
});

assert.deepEqual(getEscPosAdapterMetadata(), {
  id: ESC_POS_ADAPTER_ID,
  documentTypes: ['receipt'],
  transport: 'bytes',
  providerSpecific: true,
});

const encoded = encodeEscPosPrintJob(job);
assert.equal(encoded.adapter, 'escpos');
assert.equal(encoded.jobId, job.id);
assert.equal(encoded.documentType, 'receipt');
assert.equal(encoded.copies, 2);
assert(encoded.data instanceof Uint8Array);
assert(encoded.data.length > 20);
assert.equal(encoded.data[0], 0x1b);
assert.equal(encoded.data[1], 0x40);
assert.equal(encoded.data.at(-3), 0x1d);
assert.equal(encoded.data.at(-2), 0x56);
assert.equal(encoded.data.at(-1), 0x00);

const expected = escposEncodeReceipt({
  ...job.document,
  orderId: job.orderId,
});
assert.deepEqual(Array.from(encoded.data), Array.from(expected));

const before = JSON.stringify(job);
encodeEscPosPrintJob(job, { cut: false, drawer: true });
assert.equal(JSON.stringify(job), before);

assert.throws(
  () => encodeEscPosPrintJob(null),
  /Print job is required/
);

assert.throws(
  () => encodeEscPosPrintJob({
    ...job,
    documentType: 'invoice',
  }),
  /Unsupported print document type/
);

console.log('Phase 12.5 ESC/POS Adapter Regression: PASS');
