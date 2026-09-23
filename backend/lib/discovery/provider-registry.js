// Phase 19.2 — Discovery Provider Registry.
// Declarative/runtime registry only. It does not persist, authorize, or own
// economic entities. Providers delegate to existing domain authorities.
const providers = new Map();

function normalizeId(value) {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error('providerId must be a non-empty string'), { code: 'DISCOVERY_PROVIDER_INVALID' });
  return value.trim().toLowerCase();
}

function validateProvider(provider) {
  if (!provider || typeof provider !== 'object') throw Object.assign(new Error('Provider must be an object'), { code: 'DISCOVERY_PROVIDER_INVALID' });
  const providerId = normalizeId(provider.providerId);
  if (typeof provider.version !== 'string' || !provider.version.trim()) throw Object.assign(new Error('Provider version is required'), { code: 'DISCOVERY_PROVIDER_INVALID' });
  if (!Array.isArray(provider.entityTypes) || provider.entityTypes.length === 0) throw Object.assign(new Error('Provider entityTypes are required'), { code: 'DISCOVERY_PROVIDER_INVALID' });
  if (typeof provider.search !== 'function' || typeof provider.normalize !== 'function' || typeof provider.evidence !== 'function' || typeof provider.actions !== 'function') {
    throw Object.assign(new Error('Provider must implement search, normalize, evidence and actions'), { code: 'DISCOVERY_PROVIDER_INVALID' });
  }
  return Object.freeze({ ...provider, providerId, entityTypes: Object.freeze([...provider.entityTypes]), capabilities: Object.freeze([...(provider.capabilities || [])]), filters: Object.freeze([...(provider.filters || [])]) });
}

export function registerDiscoveryProvider(provider) {
  const normalized = validateProvider(provider);
  if (providers.has(normalized.providerId)) throw Object.assign(new Error(`Discovery provider already registered: ${normalized.providerId}`), { code: 'DISCOVERY_PROVIDER_EXISTS' });
  providers.set(normalized.providerId, normalized);
  return normalized;
}

export function unregisterDiscoveryProvider(providerId) { return providers.delete(normalizeId(providerId)); }
export function hasDiscoveryProvider(providerId) { return providers.has(normalizeId(providerId)); }
export function getDiscoveryProvider(providerId) {
  const provider = providers.get(normalizeId(providerId));
  if (!provider) throw Object.assign(new Error(`Unknown discovery provider: ${providerId}`), { code: 'DISCOVERY_PROVIDER_UNKNOWN' });
  return provider;
}
export function listDiscoveryProviders() { return [...providers.values()].map(p => ({ providerId:p.providerId, version:p.version, entityTypes:[...p.entityTypes], capabilities:[...p.capabilities], filters:[...p.filters] })); }
export function clearDiscoveryProvidersForTests() { providers.clear(); }
