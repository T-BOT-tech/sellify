import assert from 'node:assert/strict';
import {
  createReceiptPrintJob,
} from '../app/src/printing/contract.js';
import {
  encodeEscPosPrintJob,
} from '../app/src/printing/escpos-adapter.js';
import {
  WEB_BLUETOOTH_ADAPTER_ID,
  getWebBluetoothAdapterMetadata,
  requestWebBluetoothPrinter,
  printEscPosPrintJobViaBluetooth,
} from '../app/src/printing/web-bluetooth-adapter.js';

const job = createReceiptPrintJob({
  orderId: 'ORDER-12-6',
  document: {
    store: 'SELLIFY',
    header: 'RECEIPT',
    date: '2026-09-07T20:00:00Z',
    customer: { name: 'Aster' },
    items: [{ qty: 2, name: 'Coffee', amount: '100.00' }],
    total: '100.00',
    footer: 'Thank you',
  },
  copies: 2,
});

const encoded = encodeEscPosPrintJob(job);
const before = JSON.stringify(encoded, (_, value) => {
  if (value instanceof Uint8Array) return Array.from(value);
  return value;
});

assert.deepEqual(getWebBluetoothAdapterMetadata(), {
  id: WEB_BLUETOOTH_ADAPTER_ID,
  inputAdapter: 'escpos',
  transport: 'web-bluetooth',
  providerSpecific: true,
});

const device = { id: 'printer-12-6' };
const calls = [];
const transport = {
  async printEscPosBluetooth(args) {
    calls.push(args);
    return { deviceId: args.device.id, characteristicId: args.characteristicId };
  },
};

const result = await printEscPosPrintJobViaBluetooth({
  encodedPrintJob: encoded,
  device,
  serviceId: 'service-1',
  characteristicId: 'characteristic-1',
  chunkSize: 120,
  transport,
});

assert.deepEqual(result, {
  adapter: 'web-bluetooth',
  inputAdapter: 'escpos',
  jobId: job.id,
  documentType: 'receipt',
  copies: 2,
  deviceId: 'printer-12-6',
  characteristicId: 'characteristic-1',
});
assert.equal(calls.length, 1);
assert.equal(calls[0].device, device);
assert.equal(calls[0].serviceId, 'service-1');
assert.equal(calls[0].characteristicId, 'characteristic-1');
assert.equal(calls[0].chunkSize, 120);
assert(calls[0].data instanceof Uint8Array);
assert.deepEqual(Array.from(calls[0].data), Array.from(encoded.data));

const after = JSON.stringify(encoded, (_, value) => {
  if (value instanceof Uint8Array) return Array.from(value);
  return value;
});
assert.equal(after, before);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: null,
    device,
    serviceId: 'service-1',
    characteristicId: 'characteristic-1',
    transport,
  }),
  /Encoded print job is required/
);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: { ...encoded, adapter: 'other' },
    device,
    serviceId: 'service-1',
    characteristicId: 'characteristic-1',
    transport,
  }),
  /requires ESC\/POS output/
);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: { ...encoded, data: [1, 2, 3] },
    device,
    serviceId: 'service-1',
    characteristicId: 'characteristic-1',
    transport,
  }),
  /Uint8Array/
);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: encoded,
    serviceId: 'service-1',
    characteristicId: 'characteristic-1',
    transport,
  }),
  /Bluetooth printer device is required/
);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: encoded,
    device,
    characteristicId: 'characteristic-1',
    transport,
  }),
  /serviceId is required/
);

await assert.rejects(
  () => printEscPosPrintJobViaBluetooth({
    encodedPrintJob: encoded,
    device,
    serviceId: 'service-1',
    transport,
  }),
  /characteristicId is required/
);

assert.throws(
  () => requestWebBluetoothPrinter(),
  /Web Bluetooth is not supported/
);

console.log('Phase 12.6 Web Bluetooth Adapter Regression: PASS');
