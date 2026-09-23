// TG-1 — Seller-owned Telegram Storefront contract.
// This is a channel/experience boundary, not a transaction authority.
export const TELEGRAM_STOREFRONT_STATUSES = Object.freeze([
  'DRAFT', 'CONFIGURED', 'VERIFIED', 'PUBLISHED', 'PAUSED', 'UNPUBLISHED'
]);

export const TELEGRAM_STOREFRONT_CAPABILITIES = Object.freeze([
  'browse', 'search', 'product', 'cart', 'checkout', 'order_status',
  'tracking', 'proof_of_delivery', 'returns'
]);

export const TELEGRAM_STOREFRONT_CONSTITUTION = Object.freeze({
  channel: 'telegram',
  authority: 'existing_sellify_domains',
  sellerOwnership: 'organization',
  rawBotTokenPersistence: false,
  transactionAuthority: false,
  inventoryAuthority: false,
  paymentLedgerAuthority: false,
  fulfillmentAuthority: false,
  eventStoreAuthority: false,
  externalBoundary: 'canonical_contract_adapter_external_provider',
});

export function normalizeTelegramStorefrontConfig(input = {}) {
  const status = String(input.status || 'DRAFT').toUpperCase();
  if (!TELEGRAM_STOREFRONT_STATUSES.includes(status)) throw new Error('Invalid Telegram storefront status');
  const enabledCapabilities = Array.isArray(input.enabledCapabilities)
    ? [...new Set(input.enabledCapabilities.map(String).map(x => x.trim()).filter(x => TELEGRAM_STOREFRONT_CAPABILITIES.includes(x)))]
    : ['browse', 'search', 'product', 'cart', 'checkout', 'order_status'];
  return {
    channelType: 'telegram',
    botId: input.botId ? String(input.botId) : null,
    botUsername: input.botUsername ? String(input.botUsername) : null,
    credentialRef: input.credentialRef ? String(input.credentialRef) : null,
    status,
    webappUrl: input.webappUrl ? String(input.webappUrl) : null,
    enabledCapabilities,
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
  };
}
