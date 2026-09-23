// printing/web-bluetooth-adapter.js
// Phase 12.6: adapter from the provider-specific ESC/POS byte result to the
// existing Web Bluetooth transport. Browser/device behavior stays outside the
// commerce core and transport ownership remains in bluetooth.js.

import {
  isBluetoothPrintingSupported,
  requestBluetoothPrinter,
  printEscPosBluetooth,
} from './bluetooth.js';

export const WEB_BLUETOOTH_ADAPTER_ID = 'web-bluetooth';
export const WEB_BLUETOOTH_INPUT_ADAPTER_ID = 'escpos';

export function getWebBluetoothAdapterMetadata() {
  return {
    id: WEB_BLUETOOTH_ADAPTER_ID,
    inputAdapter: WEB_BLUETOOTH_INPUT_ADAPTER_ID,
    transport: 'web-bluetooth',
    providerSpecific: true,
  };
}

function validateEncodedPrintJob(encoded) {
  if (!encoded || typeof encoded !== 'object') {
    throw new Error('Encoded print job is required');
  }
  if (encoded.adapter !== WEB_BLUETOOTH_INPUT_ADAPTER_ID) {
    throw new Error(`Web Bluetooth adapter requires ESC/POS output: ${encoded.adapter || 'unknown'}`);
  }
  if (!(encoded.data instanceof Uint8Array)) {
    throw new Error('Encoded ESC/POS print data must be a Uint8Array');
  }
  if (!encoded.jobId) throw new Error('Encoded print job id is required');
  if (!Number.isInteger(encoded.copies) || encoded.copies <= 0) {
    throw new Error('Encoded print job copies must be a positive integer');
  }
  return encoded;
}

export function requestWebBluetoothPrinter(options = {}) {
  if (!isBluetoothPrintingSupported()) throw new Error('Web Bluetooth is not supported');
  return requestBluetoothPrinter(options);
}

export async function printEscPosPrintJobViaBluetooth({
  encodedPrintJob,
  device,
  serviceId,
  characteristicId,
  chunkSize,
  transport = { printEscPosBluetooth },
} = {}) {
  const encoded = validateEncodedPrintJob(encodedPrintJob);
  if (!device) throw new Error('Bluetooth printer device is required');
  if (!serviceId) throw new Error('Bluetooth printer serviceId is required');
  if (!characteristicId) throw new Error('Bluetooth printer characteristicId is required');
  if (!transport || typeof transport.printEscPosBluetooth !== 'function') {
    throw new Error('Web Bluetooth transport is required');
  }

  const result = await transport.printEscPosBluetooth({
    device,
    serviceId,
    characteristicId,
    data: encoded.data,
    chunkSize,
  });

  return {
    adapter: WEB_BLUETOOTH_ADAPTER_ID,
    inputAdapter: encoded.adapter,
    jobId: encoded.jobId,
    documentType: encoded.documentType,
    copies: encoded.copies,
    deviceId: result?.deviceId ?? device.id ?? null,
    characteristicId: result?.characteristicId ?? characteristicId,
  };
}
