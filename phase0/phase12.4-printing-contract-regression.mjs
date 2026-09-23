import assert from 'node:assert/strict';
import {
  createReceiptPrintJob,
  normalizePrintJob,
  isPrintJob,
} from '../app/src/printing/contract.js';

const orderId = 'ORDER-12-4';
const sourceDocument = {
  store: 'SELLIFY',
  header: 'RECEIPT',
  date: '2026-09-07T20:00:00Z',
  customer: { name: 'Aster', phone: '0900000000' },
  items: [{ qty: 2, name: 'Coffee', amount: '100.00' }],
  total: '100.00',
  cashTendered: '200.00',
  changeDue: '100.00',
  footer: 'Thank you',
};

const job = createReceiptPrintJob({
  orderId,
  document: sourceDocument,
  copies: 2,
  metadata: { fulfillmentType: 'pickup', fulfillmentStatus: 'picked_up' },
});

assert.equal(isPrintJob(job), true);
assert.deepEqual(job, {
  id: `order:${orderId}:receipt`,
  source: 'sellify.printing',
  documentType: 'receipt',
  orderId,
  copies: 2,
  document: sourceDocument,
  metadata: { fulfillmentType: 'pickup', fulfillmentStatus: 'picked_up' },
});
assert.notStrictEqual(job.document, sourceDocument);
assert.notStrictEqual(job.document.items, sourceDocument.items);

const normalized = normalizePrintJob({
  ...job,
  document: { ...job.document, items: [{ ...job.document.items[0] }] },
});
assert.deepEqual(normalized, job);

assert.throws(
  () => createReceiptPrintJob({ orderId, document: sourceDocument, copies: 0 }),
  /Print job/
);
assert.throws(
  () => normalizePrintJob({ id: 'x', orderId, documentType: 'invoice', document: {} }),
  /Unsupported print document type/
);
assert.equal(isPrintJob({}), false);

console.log('Phase 12.4 Printing Contract Regression: PASS');
