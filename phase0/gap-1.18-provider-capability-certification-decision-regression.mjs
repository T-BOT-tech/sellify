import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

function makeCore(evidence) {
  const stored = evidence ? [evidence] : [];
  const store = {
    async listPaymentProviderCapabilityEvidence() { return stored; },
    async certifyPaymentProviderCapability(chatId, input) {
      return { id: 'certified-118', organizationId: 'org-118', providerId: input.providerId, capability: input.capability, certificationScope: 'LIVE_EXTERNAL', status: 'CERTIFIED', evidenceId: input.evidenceId };
    },
  };
  return new PaymentCore({
    store,
    providerRegistry: {
      certifyPaymentProviderCapabilities() {
        return {
          providerId: 'test-provider',
          status: 'ADAPTER_CONTRACT_CERTIFIED',
          liveExternalCertification: false,
          certificationScope: 'ADAPTER_CONTRACT_ONLY',
        };
      },
    },
  });
}

test('GAP-1.18 does not certify without observed live evidence', async () => {
  const core = makeCore(null);
  const result = await core.certifyProviderCapability({
    chatId: 'chat-118', organizationId: 'org-118',
    providerId: 'test-provider', capability: 'verify', evidenceId: 'missing',
    actor: { userId: 'user-118', role: 'owner' },
  });
  assert.equal(result.certification.certified, false);
  assert.deepEqual(result.certification.reasonCodes, ['LIVE_EXTERNAL_EVIDENCE_NOT_FOUND']);
});

test('GAP-1.18 certifies only eligible observed evidence', async () => {
  const evidence = {
    id: 'evidence-118',
    providerId: 'test-provider',
    capability: 'verify',
    certificationScope: 'LIVE_EXTERNAL',
    status: 'OBSERVED',
    providerReference: 'external-ref-118',
    expiresAt: null,
  };
  const core = makeCore(evidence);
  const result = await core.certifyProviderCapability({
    chatId: 'chat-118', organizationId: 'org-118',
    providerId: 'test-provider', capability: 'verify', evidenceId: evidence.id,
    actor: { userId: 'user-118', role: 'owner' },
  });
  assert.equal(result.decision.certified, true);
  assert.equal(result.certification.status, 'CERTIFIED');
});

console.log('GAP-1.18 provider capability certification decision regression passed');
