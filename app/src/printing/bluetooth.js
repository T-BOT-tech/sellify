// printing/bluetooth.js
// Phase 12.1: Web Bluetooth transport. Device-specific UUIDs stay outside
// the commerce core; callers supply the printer service/characteristic.

export function isBluetoothPrintingSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export async function requestBluetoothPrinter({ filters = [], optionalServices = [] } = {}) {
  if (!isBluetoothPrintingSupported()) throw new Error('Web Bluetooth is not supported');
  const options = filters.length ? { filters, optionalServices } : { acceptAllDevices: true, optionalServices };
  return navigator.bluetooth.requestDevice(options);
}

export async function connectPrinterCharacteristic(device, serviceId, characteristicId) {
  if (!device) throw new Error('Bluetooth printer device is required');
  const server = device.gatt?.connected ? device.gatt : await device.gatt.connect();
  const service = await server.getPrimaryService(serviceId);
  return service.getCharacteristic(characteristicId);
}

export async function writeEscPos(characteristic, data, { chunkSize = 180 } = {}) {
  if (!characteristic) throw new Error('Printer characteristic is required');
  const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk);
    } else {
      throw new Error('Printer characteristic does not support writes');
    }
  }
}

export async function printEscPosBluetooth({ device, serviceId, characteristicId, data, chunkSize } = {}) {
  const characteristic = await connectPrinterCharacteristic(device, serviceId, characteristicId);
  await writeEscPos(characteristic, data, { chunkSize });
  return { deviceId: device.id, characteristicId };
}
