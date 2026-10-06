import { UnsupportedProviderOperationError, ProviderNotConfiguredError } from './provider-errors.js';

// Provider-neutral payment adapter boundary.
// Provider implementations must stay outside the payment core and must not
// perform persistence directly. The core owns state, ledger and reconciliation.

const UNSUPPORTED = Symbol('unsupported-payment-operation');

function unsupported(providerId, operation) {
  return new UnsupportedProviderOperationError(providerId, operation);
}

function notConfigured(providerId, operation) {
  return new ProviderNotConfiguredError(providerId, operation);
}

const METHODS = Object.freeze([
  'getMetadata',
  'validateAccount',
  'parseEvidence',
  'parseConfirmation',
  'authenticateNotification',
  'verify',
  'initiate',
  'getStatus',
  'refund',
  'reconcile',
  'probeCapability',
]);

function normalizeCapabilities(capabilities = {}) {
  return Object.freeze(Object.fromEntries(METHODS.map(method => [method, Boolean(capabilities[method])] )));
}

function normalizeProvider(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Payment provider adapter must be an object');
  const providerId = String(adapter.id || adapter.providerId || '').trim().toLowerCase();
  if (!providerId) throw new TypeError('Payment provider adapter requires id');

  const capabilities = normalizeCapabilities({
    ...(adapter.capabilities || {}),
    parseEvidence: adapter.capabilities?.parseEvidence ?? Boolean(adapter.parseEvidence || adapter.parseConfirmation),
    parseConfirmation: adapter.capabilities?.parseConfirmation ?? Boolean(adapter.parseConfirmation || adapter.parseEvidence),
  });
  const parseEvidence = async (...args) => {
    if (typeof adapter.parseEvidence === 'function') return adapter.parseEvidence(...args);
    if (typeof adapter.parseConfirmation === 'function') return adapter.parseConfirmation(...args);
    throw unsupported(providerId, 'parseEvidence');
  };
  const parseConfirmation = async (...args) => parseEvidence(...args);
  const methods = Object.fromEntries(METHODS.map(method => [method, async (...args) => {
    if (method === 'parseEvidence') return parseEvidence(...args);
    if (method === 'parseConfirmation') return parseConfirmation(...args);
    if (typeof adapter[method] === 'function') return adapter[method](...args);
    throw unsupported(providerId, method);
  }]));

  return Object.freeze({
    id: providerId,
    name: String(adapter.name || providerId),
    version: String(adapter.version || '1'),
    capabilities,
    configured: adapter.configured !== false,
    getMetadata: methods.getMetadata,
    validateAccount: methods.validateAccount,
    parseEvidence: methods.parseEvidence,
    parseConfirmation: methods.parseConfirmation,
    authenticateNotification: methods.authenticateNotification,
    verify: methods.verify,
    initiate: methods.initiate,
    getStatus: methods.getStatus,
    refund: methods.refund,
    reconcile: methods.reconcile,
    probeCapability: methods.probeCapability,
  });
}

const registry = new Map();

export function registerPaymentProvider(adapter, { replace = false } = {}) {
  const provider = normalizeProvider(adapter);
  if (registry.has(provider.id) && !replace) {
    const error = new Error(`Payment provider ${provider.id} is already registered`);
    error.code = 'PAYMENT_PROVIDER_ALREADY_REGISTERED';
    error.statusCode = 409;
    throw error;
  }
  registry.set(provider.id, provider);
  return provider;
}

export function getPaymentProvider(providerId) {
  const id = String(providerId || '').trim().toLowerCase();
  return registry.get(id) || null;
}

export function listPaymentProviders() {
  return [...registry.values()].map(provider => ({
    id: provider.id,
    name: provider.name,
    version: provider.version,
    capabilities: { ...provider.capabilities },
  }));
}

export function requirePaymentProvider(providerId) {
  const provider = getPaymentProvider(providerId);
  if (!provider) {
    const error = new Error(`Unknown payment provider: ${providerId}`);
    error.code = 'UNKNOWN_PAYMENT_PROVIDER';
    error.statusCode = 400;
    throw error;
  }
  return provider;
}

export function createUnconfiguredPaymentProvider({ id, name, version = '1', capabilities = {} }) {
  const providerId = String(id || '').trim().toLowerCase();
  return normalizeProvider({
    id: providerId,
    name,
    version,
    capabilities,
    configured: false,
    getMetadata: async () => ({ id: providerId, name: String(name || providerId), version }),
    validateAccount: async () => { throw notConfigured(providerId, 'validateAccount'); },
    parseEvidence: async () => { throw notConfigured(providerId, 'parseEvidence'); },
    parseConfirmation: async () => { throw notConfigured(providerId, 'parseEvidence'); },
    authenticateNotification: async () => { throw notConfigured(providerId, 'authenticateNotification'); },
    verify: async () => { throw notConfigured(providerId, 'verify'); },
    initiate: async () => { throw notConfigured(providerId, 'initiate'); },
    getStatus: async () => { throw notConfigured(providerId, 'getStatus'); },
    refund: async () => { throw notConfigured(providerId, 'refund'); },
    reconcile: async () => { throw notConfigured(providerId, 'reconcile'); },
    probeCapability: async () => { throw notConfigured(providerId, 'probeCapability'); },
  });
}

export function certifyPaymentProviderCapabilities(providerId) {
  const provider = requirePaymentProvider(providerId);
  const capabilities = { ...provider.capabilities };
  const methods = {};
  for (const method of METHODS) {
    methods[method] = typeof provider[method] === 'function';
  }
  const declaredExecutable = METHODS.filter(method => capabilities[method] === true);
  const contractMismatches = declaredExecutable.filter(method => !methods[method]);
  const unconfigured = provider.configured === false;
  return {
    providerId: provider.id,
    providerName: provider.name,
    adapterVersion: provider.version,
    status: unconfigured
      ? 'UNCONFIGURED'
      : contractMismatches.length
        ? 'CONTRACT_INVALID'
        : declaredExecutable.length
          ? 'ADAPTER_CONTRACT_CERTIFIED'
          : 'NO_EXECUTABLE_CAPABILITIES',
    liveExternalCertification: false,
    certificationScope: 'ADAPTER_CONTRACT_ONLY',
    capabilities,
    implementedMethods: methods,
    declaredExecutableCapabilities: declaredExecutable,
    contractMismatches,
    reasonCodes: unconfigured
      ? ['PROVIDER_NOT_CONFIGURED']
      : contractMismatches.length
        ? ['CAPABILITY_METHOD_MISMATCH']
        : declaredExecutable.length
          ? ['ADAPTER_METHODS_PRESENT']
          : ['NO_EXECUTABLE_CAPABILITIES'],
  };
}

export function certifyAllPaymentProviders() {
  return listPaymentProviders().map(provider => certifyPaymentProviderCapabilities(provider.id));
}

export const PAYMENT_PROVIDER_IDS = Object.freeze(['manual', 'telebirr', 'cbe', 'mpesa', 'boa']);

registerPaymentProvider({
  id: 'manual',
  name: 'Manual / Cash',
  capabilities: {
    getMetadata: true,
    validateAccount: true,
    parseConfirmation: false,
    authenticateNotification: false,
    verify: true,
    initiate: false,
    getStatus: false,
    refund: false,
    reconcile: true,
  },
  getMetadata: async () => ({ id: 'manual', name: 'Manual / Cash', version: '1', channelTypes: ['manual'] }),
  validateAccount: async account => ({ valid: Boolean(account?.accountIdentifier || account?.phone), providerId: 'manual' }),
  verify: async payment => ({ verified: true, paymentId: payment?.id || null, source: 'manual' }),
  reconcile: async input => ({ matched: true, reference: input?.externalReference || null }),
});

for (const [id, name] of [['telebirr', 'Telebirr'], ['cbe', 'CBE'], ['mpesa', 'M-Pesa'], ['boa', 'Bank of Abyssinia']]) {
  registerPaymentProvider(createUnconfiguredPaymentProvider({
    id,
    name,
    capabilities: {
      getMetadata: true,
      validateAccount: false,
      parseConfirmation: false,
      authenticateNotification: false,
      verify: false,
      initiate: false,
      getStatus: false,
      refund: false,
      reconcile: false,
    },
  }));
}

export { UNSUPPORTED };
