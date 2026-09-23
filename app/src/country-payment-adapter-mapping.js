// Phase 15.15 — Country payment adapter expansion.
// Declarative mapping only. Existing payment provider/channel registries remain
// authoritative; this module does not execute, persist, reconcile, or own money.
import { getPaymentProvider, requirePaymentProvider } from '../../backend/lib/payments/provider-registry.js';
import { getPaymentChannel, requirePaymentChannel } from '../../backend/lib/payments/channel-registry.js';

const MAPPINGS = Object.freeze({
  ET: Object.freeze({ countryCode: 'ET', currency: 'ETB', providers: Object.freeze(['telebirr', 'cbe']), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'adapter_mapping_only' }),
  KE: Object.freeze({ countryCode: 'KE', currency: 'KES', providers: Object.freeze(['mpesa']), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'adapter_mapping_only' }),
  TZ: Object.freeze({ countryCode: 'TZ', currency: 'TZS', providers: Object.freeze(['mpesa']), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'adapter_mapping_only' }),
  NG: Object.freeze({ countryCode: 'NG', currency: 'NGN', providers: Object.freeze([]), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'adapter_mapping_only' }),
  GH: Object.freeze({ countryCode: 'GH', currency: 'GHS', providers: Object.freeze([]), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'candidate_mapping_only' }),
  ZM: Object.freeze({ countryCode: 'ZM', currency: 'ZMW', providers: Object.freeze([]), channels: Object.freeze(['api', 'sms', 'manual']), implementation: 'candidate_mapping_only' }),
});

const ALIASES = Object.freeze({
  ETHIOPIA: 'ET', KENYA: 'KE', 'REPUBLIC OF KENYA': 'KE',
  TANZANIA: 'TZ', 'UNITED REPUBLIC OF TANZANIA': 'TZ',
  NIGERIA: 'NG', 'FEDERAL REPUBLIC OF NIGERIA': 'NG',
  GHANA: 'GH', ZAMBIA: 'ZM'
});

function normalizeCountryCode(countryCode) {
  const raw = String(countryCode || '').trim().toUpperCase();
  return ALIASES[raw] || raw;
}

export function listCountryPaymentAdapterMappings() {
  return Object.keys(MAPPINGS);
}

export function resolveCountryPaymentAdapterMapping(countryCode = 'ET') {
  const code = normalizeCountryCode(countryCode);
  const mapping = MAPPINGS[code];
  if (!mapping) throw Object.assign(new Error(`Unsupported country: ${countryCode}`), { code: 'COUNTRY_PAYMENT_UNSUPPORTED', statusCode: 400 });
  return Object.freeze({
    ...mapping,
    providerMetadata: Object.freeze(mapping.providers.map(id => {
      const provider = getPaymentProvider(id);
      return Object.freeze({ id, registered: Boolean(provider), capabilities: provider ? { ...provider.capabilities } : null });
    })),
    channelMetadata: Object.freeze(mapping.channels.map(id => {
      const channel = getPaymentChannel(id);
      return Object.freeze({ id, registered: Boolean(channel), capabilities: channel ? { ...channel.capabilities } : null });
    })),
  });
}

export function requireCountryPaymentAdapter(countryCode, providerId, channelId) {
  const mapping = resolveCountryPaymentAdapterMapping(countryCode);
  const provider = String(providerId || '').trim().toLowerCase();
  const channel = String(channelId || '').trim().toLowerCase();
  if (!mapping.providers.includes(provider)) throw Object.assign(new Error(`Provider ${providerId} is not mapped for country ${mapping.countryCode}`), { code: 'COUNTRY_PAYMENT_PROVIDER_NOT_MAPPED', statusCode: 400 });
  if (!mapping.channels.includes(channel)) throw Object.assign(new Error(`Channel ${channelId} is not mapped for country ${mapping.countryCode}`), { code: 'COUNTRY_PAYMENT_CHANNEL_NOT_MAPPED', statusCode: 400 });
  return Object.freeze({ provider: requirePaymentProvider(provider), channel: requirePaymentChannel(channel), executable: false, integrationStatus: 'deferred' });
}

export const countryPaymentAdapterContract = Object.freeze({
  phase: '15.15',
  authority: 'country_payment_adapter_mapping',
  providerRegistryAuthority: 'backend/lib/payments/provider-registry.js',
  channelRegistryAuthority: 'backend/lib/payments/channel-registry.js',
  persistence: 'none',
  ownsPaymentState: false,
  ownsPaymentLedger: false,
  ownsProviderCredentials: false,
  executesProviderCalls: false,
  integrationStatus: 'mapping_only',
  providerBoundary: 'Country Mapping → Existing Payment Adapter Registry → Provider',
  countryOverlayRequired: true,
  regionalPaymentExecution: 'existing_payment_authority_only',
});
