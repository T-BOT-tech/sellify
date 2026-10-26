// Only these backend-owned, browser-safe policy/projection modules are exposed
// to the PWA module graph. The API server remains the security authority; this
// is source-code delivery, not an authorization bypass or data endpoint.
export const BROWSER_BACKEND_MODULES = Object.freeze([
  'lib/authorization.js',
  'lib/country-security-expansion.js',
  'lib/country-security-isolation.js',
  'lib/payments/channel-registry.js',
  'lib/payments/provider-errors.js',
  'lib/payments/provider-registry.js',
  'lib/resource-action-registry.js',
  'lib/security-context.js',
  'lib/tenant-isolation.js',
]);

export const BROWSER_SHARED_MODULES = Object.freeze([
  'vertical-pack-manifests.js',
]);
