// FUX-14: Device & Hardware Experience Contract
// Experience-only device matrix. Platform adapters remain responsible for
// actual device I/O; no device capability becomes a Commerce/Payment/etc authority.

export const DEVICE_CAPABILITY_STATES = Object.freeze([
  'AVAILABLE',
  'UNAVAILABLE',
  'PERMISSION_REQUIRED',
  'DEGRADED',
  'DISCONNECTED',
  'UNKNOWN',
]);

export const DEVICE_CAPABILITIES = Object.freeze([
  'camera',
  'barcode_scanner',
  'printing',
  'bluetooth',
  'notifications',
  'biometrics',
]);

const ADAPTERS = Object.freeze({
  camera: 'platform-adapter',
  barcode_scanner: 'platform-adapter',
  printing: 'printing-contract',
  bluetooth: 'web-bluetooth',
  notifications: 'platform-adapter',
  biometrics: 'platform-adapter',
});

export function createDeviceExperienceMatrix({ channel = 'web', capabilities = {} } = {}) {
  if (typeof channel !== 'string' || !channel.trim()) throw new Error('Device channel is required');

  const entries = {};
  for (const capability of DEVICE_CAPABILITIES) {
    const input = capabilities[capability] || {};
    const state = input.state || 'UNKNOWN';
    if (!DEVICE_CAPABILITY_STATES.includes(state)) {
      throw new Error(`Unsupported device capability state: ${state}`);
    }
    entries[capability] = {
      state,
      adapter: input.adapter || ADAPTERS[capability],
      degradedReason: state === 'DEGRADED' ? (input.degradedReason || null) : null,
      recovery: input.recovery || null,
    };
  }

  return Object.freeze({
    channel,
    capabilities: Object.freeze(entries),
    authority: 'existing-platform-and-domain-authorities',
    execution: 'device-adapter-only',
  });
}

export function getDeviceCapability(matrix, capability) {
  if (!matrix?.capabilities?.[capability]) throw new Error(`Unknown device capability: ${capability}`);
  return matrix.capabilities[capability];
}

export function canUseDeviceCapability(matrix, capability) {
  const state = getDeviceCapability(matrix, capability).state;
  return state === 'AVAILABLE';
}

export function describeDeviceRecovery(matrix, capability) {
  const entry = getDeviceCapability(matrix, capability);
  if (entry.state === 'AVAILABLE') return null;
  if (entry.state === 'PERMISSION_REQUIRED') return 'Request device permission before continuing.';
  if (entry.state === 'DISCONNECTED') return 'Reconnect the device, then retry the operation.';
  if (entry.state === 'DEGRADED') return entry.recovery || 'Use the supported degraded path or another device.';
  if (entry.state === 'UNAVAILABLE') return entry.recovery || 'Use another supported channel or device.';
  return entry.recovery || 'Device capability status is unknown; do not claim successful device execution.';
}
