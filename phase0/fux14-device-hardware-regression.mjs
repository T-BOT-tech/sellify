import assert from 'node:assert/strict';
import {
  createDeviceExperienceMatrix,
  getDeviceCapability,
  canUseDeviceCapability,
  describeDeviceRecovery,
} from '../app/src/device/device-experience-contract.js';

const matrix = createDeviceExperienceMatrix({
  channel: 'pos',
  capabilities: {
    camera: { state: 'AVAILABLE' },
    barcode_scanner: { state: 'DEGRADED', degradedReason: 'scanner unavailable', recovery: 'Use camera scanning.' },
    printing: { state: 'AVAILABLE' },
    bluetooth: { state: 'DISCONNECTED' },
    notifications: { state: 'PERMISSION_REQUIRED' },
    biometrics: { state: 'UNKNOWN' },
  },
});

assert.equal(matrix.channel, 'pos');
assert.equal(matrix.authority, 'existing-platform-and-domain-authorities');
assert.equal(matrix.execution, 'device-adapter-only');
assert.equal(canUseDeviceCapability(matrix, 'camera'), true);
assert.equal(canUseDeviceCapability(matrix, 'barcode_scanner'), false);
assert.deepEqual(getDeviceCapability(matrix, 'barcode_scanner'), {
  state: 'DEGRADED',
  adapter: 'platform-adapter',
  degradedReason: 'scanner unavailable',
  recovery: 'Use camera scanning.',
});
assert.equal(describeDeviceRecovery(matrix, 'bluetooth'), 'Reconnect the device, then retry the operation.');
assert.equal(describeDeviceRecovery(matrix, 'notifications'), 'Request device permission before continuing.');
assert.equal(describeDeviceRecovery(matrix, 'biometrics'), 'Device capability status is unknown; do not claim successful device execution.');

assert.throws(
  () => createDeviceExperienceMatrix({ channel: 'pos', capabilities: { camera: { state: 'SUCCESS' } } }),
  /Unsupported device capability state/
);
assert.throws(
  () => getDeviceCapability(matrix, 'gps'),
  /Unknown device capability/
);

console.log('FUX-14 Device & Hardware Regression: PASS');
