// GAP-1.18 provider capability probing boundary.
// This module owns normalization of provider-specific probe results only.
// It never persists evidence, mutates Payment state, or certifies a provider.

const VALID_STATUSES = new Set(['VERIFIED', 'FAILED', 'UNKNOWN']);

export function normalizeCapabilityProbeResult(result = {}, context = {}) {
  const rawStatus = String(result.status || result.result || '').trim().toUpperCase();
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : 'UNKNOWN';
  const providerReference = result.providerReference ?? result.provider_reference ?? result.reference ?? null;
  const observedAt = result.observedAt ?? result.observed_at ?? new Date().toISOString();
  const expiresAt = result.expiresAt ?? result.expires_at ?? null;

  return {
    providerId: String(context.providerId || result.providerId || result.provider_id || '').trim().toLowerCase(),
    capability: String(context.capability || result.capability || '').trim(),
    status,
    providerReference: providerReference == null ? null : String(providerReference),
    observedAt,
    expiresAt,
    evidence: sanitizeProbeEvidence(result.evidence ?? result.raw ?? result.response ?? result),
    reasonCodes: Array.isArray(result.reasonCodes)
      ? result.reasonCodes.map(value => String(value)).slice(0, 20)
      : [],
  };
}

function sanitizeProbeEvidence(value) {
  if (value == null) return {};
  if (typeof value !== 'object') return { value: String(value) };
  if (Array.isArray(value)) return { items: value.slice(0, 50) };
  const blocked = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'access_token', 'refresh_token', 'client_secret', 'api_key', 'bot_token']);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (blocked.has(String(key).toLowerCase())) continue;
    if (typeof item === 'string' && item.length > 4096) {
      output[key] = item.slice(0, 4096);
    } else {
      output[key] = item;
    }
  }
  return output;
}

export async function probeProviderCapability(provider, { capability, context = {} } = {}) {
  const providerId = String(provider?.id || '').trim().toLowerCase();
  const normalizedCapability = String(capability || '').trim();
  if (!providerId) throw Object.assign(new Error('Provider is required'), { statusCode: 400, code: 'PROVIDER_CONTEXT_REQUIRED' });
  if (!normalizedCapability) throw Object.assign(new Error('Capability is required'), { statusCode: 400, code: 'PROVIDER_CAPABILITY_REQUIRED' });

  if (typeof provider.probeCapability !== 'function') {
    return normalizeCapabilityProbeResult({
      status: 'UNKNOWN',
      reasonCodes: ['PROVIDER_CAPABILITY_PROBE_UNAVAILABLE'],
    }, { providerId, capability: normalizedCapability });
  }

  try {
    const result = await provider.probeCapability({
      providerId,
      capability: normalizedCapability,
      context,
    });
    return normalizeCapabilityProbeResult(result, { providerId, capability: normalizedCapability });
  } catch (error) {
    if (['PAYMENT_PROVIDER_NOT_CONFIGURED', 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED'].includes(error?.code)) {
      return normalizeCapabilityProbeResult({
        status: 'UNKNOWN',
        reasonCodes: [error.code],
        evidence: { providerError: error.code },
      }, { providerId, capability: normalizedCapability });
    }
    return normalizeCapabilityProbeResult({
      status: 'FAILED',
      reasonCodes: ['PROVIDER_CAPABILITY_PROBE_FAILED'],
      evidence: { providerError: error?.code || 'PROVIDER_PROBE_FAILED' },
    }, { providerId, capability: normalizedCapability });
  }
}
