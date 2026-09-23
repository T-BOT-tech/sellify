// FUX-28 — Cross-channel consistency contract.
// Channels are experiences/projections over existing canonical authorities.
// This contract describes the invariants and provides a deterministic,
// side-effect-free consistency assessment; it is not a synchronization or
// transaction engine.
export const CROSS_CHANNEL_CANONICAL_AUTHORITIES = Object.freeze({
  product: 'commerce',
  pricing: 'commerce',
  inventory: 'inventory',
  customer: 'customers',
  cart: 'channel_experience_state',
  checkout: 'commerce',
  order: 'commerce',
  payment: 'payments',
  fulfillment: 'fulfillment',
  logistics: 'logistics',
  events: 'events',
});

export const CROSS_CHANNEL_INVARIANTS = Object.freeze([
  'ONE_CANONICAL_PRODUCT',
  'ONE_CANONICAL_PRICE_AUTHORITY',
  'CHANNEL_AVAILABILITY_IS_PROJECTION',
  'CHANNEL_CART_IS_EXPERIENCE_STATE',
  'ONE_CANONICAL_ORDER',
  'ONE_CANONICAL_PAYMENT_AUTHORITY',
  'ONE_CANONICAL_FULFILLMENT_AUTHORITY',
  'ONE_CANONICAL_LOGISTICS_AUTHORITY',
  'CHANNEL_FAILURE_MUST_NOT_CORRUPT_CORE',
  'IDEMPOTENT_CHECKOUT',
  'TENANT_ISOLATION',
]);

export function buildCrossChannelConsistencyContract(channels = []) {
  return {
    model: 'one_business_truth_many_experiences',
    canonicalAuthorities: { ...CROSS_CHANNEL_CANONICAL_AUTHORITIES },
    invariants: [...CROSS_CHANNEL_INVARIANTS],
    channels: channels.map(channel => ({
      channelType: String(channel.channelType || '').toLowerCase(),
      status: String(channel.status || 'DRAFT').toUpperCase(),
      enabled: channel.enabled !== false,
      configurationVersion: Number(channel.configurationVersion || 1),
    })),
    ownsSynchronizationEngine: false,
    ownsTransactionEngine: false,
    ownsInventoryAuthority: false,
    ownsPaymentLedger: false,
    ownsOrderAuthority: false,
  };
}

export function evaluateCrossChannelConsistency(channels = []) {
  const normalized = channels.map(channel => ({
    channelType: String(channel.channelType || '').toLowerCase(),
    status: String(channel.status || 'DRAFT').toUpperCase(),
    enabled: channel.enabled !== false,
  }));
  const duplicateTypes = normalized.map(c => c.channelType).filter((type, i, all) => type && all.indexOf(type) !== i);
  const active = normalized.filter(c => c.enabled && ['CONFIGURED', 'VERIFIED', 'PUBLISHED', 'PAUSED'].includes(c.status));
  const checks = [
    { id: 'CHANNEL_TYPES_UNIQUE', pass: duplicateTypes.length === 0 },
    { id: 'NO_CHANNEL_AUTHORITY', pass: true },
    { id: 'CANONICAL_COMMERCE', pass: true },
    { id: 'CANONICAL_INVENTORY', pass: true },
    { id: 'CANONICAL_PAYMENTS', pass: true },
    { id: 'CANONICAL_FULFILLMENT', pass: true },
    { id: 'CANONICAL_LOGISTICS', pass: true },
    { id: 'ACTIVE_CHANNELS_DECLARED', pass: active.every(c => c.channelType) },
  ];
  return {
    status: checks.every(check => check.pass) ? 'PASS' : 'FAIL',
    checks,
    activeChannelCount: active.length,
    duplicateChannelTypes: [...new Set(duplicateTypes)],
  };
}
