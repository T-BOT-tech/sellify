import assert from 'node:assert/strict';
import { registerPaymentProvider, getPaymentProvider } from '../backend/lib/payments/provider-registry.js';
import { probeProviderCapability } from '../backend/lib/payments/provider-capability-probe.js';

const providerId = 'gap118-probe-fixture';
registerPaymentProvider({
  id: providerId,
  name: 'GAP-1.18 Probe Fixture',
  configured: true,
  capabilities: { getMetadata: true },
  getMetadata: async () => ({ id: providerId }),
  probeCapability: async ({ capability }) => ({
    status: 'VERIFIED',
    capability,
    providerReference: 'external-118',
    evidence: {
      capability,
      endpoint: 'fixture://provider',
      authorization: 'MUST_NOT_PERSIST',
    },
  }),
});

const verified = await probeProviderCapability(getPaymentProvider(providerId), {
  capability: 'refund',
  context: { organizationId: 'org-118' },
});
assert.equal(verified.status, 'VERIFIED');
assert.equal(verified.providerReference, 'external-118');
assert.equal(verified.evidence.authorization, undefined);

registerPaymentProvider({
  id: 'gap118-unconfigured-fixture',
  name: 'GAP-1.18 Unconfigured Fixture',
  configured: false,
  capabilities: {},
  probeCapability: async () => {
    const error = new Error('not configured');
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw error;
  },
});

const unknown = await probeProviderCapability(getPaymentProvider('gap118-unconfigured-fixture'), {
  capability: 'refund',
});
assert.equal(unknown.status, 'UNKNOWN');
assert.equal(unknown.reasonCodes[0], 'PAYMENT_PROVIDER_NOT_CONFIGURED');

console.log('GAP-1.18 provider capability probe regression passed');
