// Phase 19 Discovery Fabric provider bootstrap.
import { registerDiscoveryProvider, getDiscoveryProvider, listDiscoveryProviders } from './provider-registry.js';
import { marketplaceProductDiscoveryProvider } from './marketplace-product-provider.js';
import { marketplaceOrganizationDiscoveryProvider } from './marketplace-organization-provider.js';
import { supplierNetworkDiscoveryProvider } from './supplier-network-provider.js';

for (const provider of [marketplaceProductDiscoveryProvider, marketplaceOrganizationDiscoveryProvider, supplierNetworkDiscoveryProvider]) {
  if (!listDiscoveryProviders().some(p => p.providerId === provider.providerId)) registerDiscoveryProvider(provider);
}

export { registerDiscoveryProvider, getDiscoveryProvider, listDiscoveryProviders };

export { normalizeDiscoveryMarketContext, discoveryMarketContextContract } from './market-context.js';
export { discoveryMatchingContract, evaluateDiscoveryMatch, matchDiscoveryCandidates, DISCOVERY_MATCHING_VERSION, DISCOVERY_MATCH_WEIGHTS } from './matching-contract.js';

export { discoveryOpportunityContract, buildDiscoveryOpportunity, buildDiscoveryOpportunities, DISCOVERY_OPPORTUNITY_VERSION } from './opportunity-model.js';

export { unifiedDiscoveryContract, discoverUnified, UNIFIED_DISCOVERY_VERSION, DEFAULT_DISCOVERY_PROVIDERS } from './unified-discovery.js';
export { discoveryAiIntentTranslationContract, translateDiscoveryIntent, validateTranslatedDiscoveryIntent, discoverFromNaturalLanguage, DISCOVERY_AI_INTENT_VERSION } from './ai-intent-translation.js';
