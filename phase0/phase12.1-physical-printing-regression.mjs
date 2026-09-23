import assert from 'node:assert/strict';
import { toPhysicalFlow, isPhysicalFulfillment } from '../app/src/logistics/physical-flow.js';
import { escposEncodeReceipt } from '../app/src/printing/escpos.js';

const order = {
  id: 'ORDER-12',
  fulfillment_type: 'delivery',
  fulfillment_status: 'pending',
  fulfillment_address: 'Bonga',
  fulfillment_scheduled_time: '2026-09-07T20:00',
};

assert.equal(isPhysicalFulfillment(order), true);
assert.deepEqual(toPhysicalFlow(order), {
  id: 'order:ORDER-12', source: 'sellify.order', orderId: 'ORDER-12', type: 'delivery',
  status: 'pending', destination: 'Bonga', scheduledAt: '2026-09-07T20:00',
  trackingReference: null, proof: null, stockDeducted: false, final: false,
});
assert.equal(toPhysicalFlow({ id: 'X' }), null);

const encoded = escposEncodeReceipt({
  store: 'SELLIFY', header: 'RECEIPT', orderId: 'ORDER-12',
  items: [{ qty: 2, name: 'Coffee', amount: '100.00' }], total: '100.00', footer: 'Thank you'
});
assert(encoded instanceof Uint8Array);
assert(encoded.length > 20);
assert.equal(encoded[0], 0x1b);
assert.equal(encoded[1], 0x40);
assert.equal(encoded.at(-3), 0x1d);
assert.equal(encoded.at(-2), 0x56);
assert.equal(encoded.at(-1), 0x00);

console.log('Phase 12.1 Physical Commerce / Printing Contract Regression: PASS');
