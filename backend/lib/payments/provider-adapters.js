// GAP-1.18 provider adapter skeletons.
// These adapters intentionally do not assume undocumented provider APIs.
// A deployment must supply both an approved base URL and credential; until
// then probes return UNKNOWN through the standard unconfigured boundary.

import { getProviderAdapterConfig } from './provider-adapter-config.js';
import { requestProviderProbe } from './provider-probe-transport.js';

const PROVIDERS = Object.freeze([
  ['telebirr', 'Telebirr'],
  ['cbe', 'CBE'],
  ['mpesa', 'M-Pesa'],
  ['boa', 'Bank of Abyssinia'],
]);

function createProviderAdapter(id, name) {
  return {
    id,
    name,
    version: '1',
    capabilities: {
      getMetadata: true,
      probeCapability: true,
    },
    configured: getProviderAdapterConfig(id).configured,
    getMetadata: async () => ({ id, name, version: '1' }),
    probeCapability: async ({ capability, context = {} }) => {
      const config = getProviderAdapterConfig(id, context.env || process.env);
      if (!config.configured) {
        const error = new Error(`${name} is not configured`);
        error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
        throw error;
      }

      // The path is intentionally supplied by deployment context because
      // provider API contracts must be verified from current provider docs.
      const path = context.probePath;
      if (!path) {
        return {
          status: 'UNKNOWN',
          capability,
          reasonCodes: ['PROVIDER_PROBE_PATH_NOT_CONFIGURED'],
          evidence: { providerId: id },
        };
      }

      const response = await requestProviderProbe({
        baseUrl: config.baseUrl,
        apiKey: process.env[
          ({ telebirr: 'SELLIFY_TELEBIRR_API_KEY', cbe: 'SELLIFY_CBE_API_KEY',
             mpesa: 'SELLIFY_MPESA_API_KEY', boa: 'SELLIFY_BOA_API_KEY' })[id]
        ],
        path,
        method: context.probeMethod || 'GET',
        timeoutMs: context.timeoutMs || 5000,
      });

      return {
        status: response.ok ? 'VERIFIED' : 'FAILED',
        capability,
        providerReference: response.payload?.reference || response.payload?.transactionId || null,
        evidence: {
          providerId: id,
          capability,
          httpStatus: response.statusCode,
          response: response.payload,
        },
        reasonCodes: response.ok ? ['PROVIDER_RESPONSE_OK'] : ['PROVIDER_RESPONSE_NOT_OK'],
      };
    },
  };
}

export const PROVIDER_ADAPTERS = Object.freeze(
  Object.fromEntries(PROVIDERS.map(([id, name]) => [id, createProviderAdapter(id, name)]))
);

export function getConfiguredProviderAdapters() {
  return Object.values(PROVIDER_ADAPTERS).filter(provider => provider.configured);
}
