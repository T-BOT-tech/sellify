// GAP-1.18B deployment-only provider configuration.
// Credentials remain process-local. Configuration metadata never returns
// credential values. Authentication interpretation belongs to adapters.

const PROVIDER_ENV = Object.freeze({
  telebirr: { baseUrl: 'SELLIFY_TELEBIRR_BASE_URL', apiKey: 'SELLIFY_TELEBIRR_API_KEY' },
  cbe: { baseUrl: 'SELLIFY_CBE_BASE_URL', apiKey: 'SELLIFY_CBE_API_KEY' },
  mpesa: { baseUrl: 'SELLIFY_MPESA_BASE_URL', apiKey: 'SELLIFY_MPESA_API_KEY' },
  boa: { baseUrl: 'SELLIFY_BOA_BASE_URL', apiKey: 'SELLIFY_BOA_API_KEY' },
});

export function getProviderAdapterConfig(providerId, env = process.env) {
  const id = String(providerId || '').trim().toLowerCase();
  const names = PROVIDER_ENV[id];
  if (!names) return { providerId: id, configured: false, baseUrl: null, hasCredential: false };
  const baseUrl = String(env[names.baseUrl] || '').trim();
  const credential = String(env[names.apiKey] || '').trim();
  return {
    providerId: id,
    configured: Boolean(baseUrl && credential),
    baseUrl: baseUrl || null,
    hasCredential: Boolean(credential),
  };
}

export function providerConfigNames(providerId) {
  const id = String(providerId || '').trim().toLowerCase();
  return PROVIDER_ENV[id] ? { ...PROVIDER_ENV[id] } : null;
}
