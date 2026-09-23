// FUX-26/FUX-27 — generic seller-owned channel storefront contract.
// Channel configuration is presentation/distribution metadata only. Existing
// domain authorities remain canonical for commerce, inventory, payments,
// fulfillment, identity, events, and analytics.
export const SELLER_STOREFRONT_CHANNEL_TYPES = Object.freeze([
  'web', 'pwa', 'telegram', 'native_android', 'native_ios', 'embedded', 'partner'
]);

export const SELLER_STOREFRONT_CONSTITUTION = Object.freeze({
  authority: 'seller_channel_configuration',
  businessAuthority: 'existing_sellify_domains',
  transactionAuthority: false,
  inventoryAuthority: false,
  paymentLedgerAuthority: false,
  fulfillmentAuthority: false,
  identityAuthority: false,
  eventStoreAuthority: false,
  analyticsAuthority: false,
});

export function normalizeSellerStorefrontChannel(input = {}) {
  const channelType = String(input.channelType || '').trim().toLowerCase();
  if (!SELLER_STOREFRONT_CHANNEL_TYPES.includes(channelType)) {
    throw new Error('Invalid seller storefront channel type');
  }
  return {
    channelType,
    status: String(input.status || 'DRAFT').toUpperCase(),
    enabled: input.enabled !== false,
    displayName: input.displayName ? String(input.displayName) : channelType,
    capabilities: Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String))] : [],
    configurationVersion: Number(input.configurationVersion || 1),
  };
}

export function buildSellerStorefrontChannelSummary(config) {
  return normalizeSellerStorefrontChannel({
    channelType: config?.channelType,
    status: config?.status,
    enabled: ['PUBLISHED', 'VERIFIED', 'CONFIGURED', 'PAUSED'].includes(config?.status),
    displayName: config?.displayName || config?.channelType,
    capabilities: config?.enabledCapabilities || [],
    configurationVersion: config?.version || 1,
  });
}
