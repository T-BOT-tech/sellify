// GAP-1.18B provider adapters.
// Authentication belongs to each provider adapter. The shared transport never
// interprets credentials, API keys, OAuth tokens, signatures, or certificates.

import { getProviderAdapterConfig } from './provider-adapter-config.js';
import { requestProviderProbe } from './provider-probe-transport.js';
import { PROVIDER_VERIFICATION_PARSERS } from './provider-verification-parsers.js';

const PROVIDERS = Object.freeze([
  ['telebirr', 'Telebirr'],
  ['cbe', 'CBE'],
  ['mpesa', 'M-Pesa'],
  ['boa', 'Bank of Abyssinia'],
]);

const ENV_CREDENTIAL = Object.freeze({
  telebirr: 'SELLIFY_TELEBIRR_API_KEY',
  cbe: 'SELLIFY_CBE_API_KEY',
  mpesa: 'SELLIFY_MPESA_API_KEY',
  boa: 'SELLIFY_BOA_API_KEY',
});

// Temporary deployment authentication contract. It is intentionally selected
// by the adapter, not the transport. Provider-specific OAuth/HMAC/signature
// implementations can replace these functions without changing HTTP transport.
const ADAPTER_AUTH = Object.freeze({
  telebirr: ({ credential }) => credential ? { authorization: `Bearer ${credential}` } : {},
  cbe: ({ credential }) => credential ? { authorization: `Bearer ${credential}` } : {},
  mpesa: ({ credential }) => credential ? { authorization: `Bearer ${credential}` } : {},
  boa: ({ credential }) => credential ? { authorization: `Bearer ${credential}` } : {},
});

function createProviderAdapter(id, name) {
  return {
    id,
    name,
    version: '1',
    capabilities: { getMetadata: true, probeCapability: true },
    configured: getProviderAdapterConfig(id).configured,
    getMetadata: async () => ({ id, name, version: '1' }),
    probeCapability: async ({ capability, context = {} }) => {
      const config = getProviderAdapterConfig(id, context.env || process.env);
      if (!config.configured) {
        const error = new Error(`${name} is not configured`);
        error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
        throw error;
      }

      const path = context.probePath;
      if (!path) {
        return {
          status: 'UNKNOWN',
          capability,
          reasonCodes: ['PROVIDER_PROBE_PATH_NOT_CONFIGURED'],
          evidence: { providerId: id },
        };
      }

      const env = context.env || process.env;
      const credential = String(env[ENV_CREDENTIAL[id]] || '').trim();
      const authHeaders = ADAPTER_AUTH[id]?.({ credential, context }) || {};
      const response = await requestProviderProbe({
        baseUrl: config.baseUrl,
        path,
        method: context.probeMethod || 'GET',
        timeoutMs: context.timeoutMs || 5000,
        headers: authHeaders,
        body: context.body,
        fetchImpl: context.fetchImpl,
      });

      const parsed = PROVIDER_VERIFICATION_PARSERS[id](response.payload || {}, {
        operation: 'probeCapability',
        capability,
      });
      return {
        ...parsed,
        status: response.ok ? parsed.status : 'FAILED',
        capability,
        reasonCodes: response.ok
          ? parsed.reasonCodes
          : ['PROVIDER_HTTP_RESPONSE_NOT_OK', ...parsed.reasonCodes],
        evidence: {
          ...parsed.evidence,
          httpStatus: response.statusCode,
          transportOk: response.ok,
        },
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
