import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const records = [];
const store = {
  async listPaymentProviderCapabilityEvidence() {
    return [];
  },
  async recordPaymentProductionCertification(chatId, input) {
    const record = { id: 'prod-cert-1', organizationId: input.organizationId || 'org-119', ...input };
    records.push(record);
    return record;
  },
};
const core = new PaymentCore({
  store,
  providerRegistry: {
    certifyPaymentProviderCapabilities() {
      return {
        providerId: 'telebirr',
        configured: false,
        status: 'UNCONFIGURED',
        liveExternalCertification: false,
      };
    },
  },
});

const result = await core.certifyProductionReadiness({
  chatId: 'chat-119',
  organizationId: 'org-119',
  providerId: 'telebirr',
  requiredCapabilities: ['initiate', 'getStatus', 'verify', 'reconcile', 'refund'],
  actor: { userId: 'user-119', role: 'owner' },
});

assert.equal(result.status, 'BLOCKED');
assert.ok(result.reasons.includes('PROVIDER_NOT_CONFIGURED'));
assert.ok(result.reasons.includes('ADAPTER_CONTRACT_NOT_CERTIFIED'));
assert.ok(result.reasons.includes('LIVE_EXTERNAL_CAPABILITY_EVIDENCE_MISSING'));
assert.equal(records.length, 1);
assert.equal(records[0].status, 'BLOCKED');

console.log('GAP-1.19 production certification gate regression passed');
