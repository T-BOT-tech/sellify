// platform/index.js
// Phase 9 extraction (see modularization plan §5): the public entry point
// for the platform-adapter layer. Everything outside platform/*.js —
// main.js, theme/branding.js, orders/checkout.js, orders/cart.js,
// marketplace/checkout.js — imports getActivePlatform()/initPlatform() from
// here and never reaches into registry.js or a specific adapter file
// directly, the same way feature modules go through ui/render.js's
// renderAll() rather than importing individual renderers.
import { resolveActivePlatform } from './registry.js';

// Returns the cached active adapter, resolving it on first call.
export function getActivePlatform() {
  return resolveActivePlatform();
}

// One-time boot hook — resolves the active adapter (if not already cached)
// and runs its init(). Called once from main.js's boot sequence, in the
// same spot the old inline Telegram WebApp lifecycle block used to run.
export function initPlatform() {
  const platform = resolveActivePlatform();
  platform.init();
  return platform;
}

// Phase 16 canonical platform contracts. These exports keep consumers on the
// platform boundary instead of reaching into individual registry modules.
export {
  getPlatformCapability,
  listPlatformCapabilities,
  definePlatformCapability,
} from './capability-contract.js';
export {
  getPlatformAuthority,
  listPlatformAuthorities,
  resolveAuthorityForCapability,
} from './authority-registry.js';
export {
  getPlatformAdapter,
  listPlatformAdapters,
  registerPlatformAdapter,
  resolveAdapterBoundary,
  definePlatformAdapter,
} from './adapter-framework.js';
export {
  getPlatformIntegration,
  listPlatformIntegrations,
  registerPlatformIntegration,
  resolveIntegrationBoundary,
  definePlatformIntegration,
  platformIntegrationContract,
  assertIntegrationBoundary,
} from './integration-contract.js';
export {
  discoverPlatformCapabilities,
  discoverPlatformCapability,
  discoverCapabilityAction,
  discoverPlatformSurface,
  assertCapabilityDiscoveryRequest,
  platformCapabilityDiscoveryContract,
} from './capability-discovery.js';
export {
  parsePlatformContractVersion,
  comparePlatformContractVersions,
  isPlatformContractCompatible,
  assertPlatformContractCompatibility,
  resolvePlatformContractVersion,
  definePlatformContractVersion,
  platformContractVersioningContract,
} from './contract-versioning.js';
export {
  PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION,
  listPlatformSupportedEventTypes,
  isPlatformSupportedEventType,
  buildPlatformVersionedEvent,
  enqueuePlatformVersionedEvent,
  assertPlatformEventOutboxBoundary,
  platformEventOutboxContract,
  definePlatformEventOutboxContract,
} from './event-outbox-platform.js';
export {
  PLATFORM_INTEGRATION_GATEWAY_VERSION,
  validateIntegrationGatewayRequest,
  resolveIntegrationGatewayRequest,
  executeIntegrationGatewayRequest,
  platformIntegrationGatewayContract,
  assertIntegrationGatewayBoundary,
} from './integration-gateway.js';
export {
  PLATFORM_COMPOSITION_VERSION,
  resolvePlatformTenantCountryVerticalComposition,
  platformTenantCountryVerticalCompositionContract,
  assertPlatformTenantCountryVerticalBoundary,
} from './tenant-country-vertical.js';
export {
  PLATFORM_AI_CAPABILITY_BOUNDARY_VERSION,
  defineAiCapabilityIntent,
  resolveAiCapabilityIntent,
  assertAiCapabilityBoundary,
  platformAiCapabilityBoundaryContract,
} from './ai-capability-boundary.js';
export {
  PLATFORM_SECURITY_VERSION,
  PLATFORM_SECURITY_FORBIDDEN_AUTHORITIES,
  validatePlatformSecurityRequest,
  resolvePlatformSecurityRequest,
  authorizePlatformRequest,
  assertPlatformSecurityBoundary,
  platformSecurityContract,
} from './platform-security.js';
