import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

function makeStore() {
  const rows = [];
  return {
    async recordPaymentProviderCapabilityEvidence(chatId, input, actor) {
      const fingerprint = [input.providerId, input.capability, input.certificationScope || 'LIVE_EXTERNAL', JSON.stringify(input.evidence || {})].join('|');
      const existing = rows.find(row => row.evidenceFingerprint === fingerprint);
      if (existing) return existing;
      const row = {
        id: 'cert-' + (rows.length + 1),
        organizationId: input.organizationId,
        providerId: input.providerId,
        capability: input.capability,
        certificationScope: String(input.certificationScope || 'LIVE_EXTERNAL').toUpperCase(),
        status: String(input.status || 'UNKNOWN').toUpperCase() === 'OBSERVED' ? 'OBSERVED' : 'UNKNOWN',
        evidence: input.evidence || {},
        evidenceFingerprint: fingerprint,
        providerReference: input.providerReference || null,
      };
      rows.push(row);
      return row;
    },
    async listPaymentProviderCapabilityEvidence(chatId, providerId, options = {}) {
      return rows.filter(row =>
        (!providerId || row.providerId === providerId) &&
        (!options.capability || row.capability === options.capability)
      );
    },
  };
}

const store = makeStore();
const core = new PaymentCore({ store });
const actor = { userId: 'user-118', role: 'owner' };

const observed = await core.recordProviderCapabilityEvidence({
  chatId: 'chat-118',
  organizationId: 'org-118',
  providerId: 'telebirr',
  capability: 'refund',
  certificationScope: 'LIVE_EXTERNAL',
  status: 'CERTIFIED',
  providerReference: 'provider-ref-118',
  evidence: { source: 'external-report', observedAt: '2026-10-01T00:00:00Z' },
  actor,
});

assert.equal(observed.status, 'UNKNOWN');
assert.equal(observed.certificationScope, 'LIVE_EXTERNAL');

const duplicate = await core.recordProviderCapabilityEvidence({
  chatId: 'chat-118',
  organizationId: 'org-118',
  providerId: 'telebirr',
  capability: 'refund',
  certificationScope: 'LIVE_EXTERNAL',
  status: 'CERTIFIED',
  providerReference: 'provider-ref-118',
  evidence: { source: 'external-report', observedAt: '2026-10-01T00:00:00Z' },
  actor,
});
assert.equal(duplicate.id, observed.id);

const listed = await core.listProviderCapabilityEvidence({
  chatId: 'chat-118',
  organizationId: 'org-118',
  providerId: 'telebirr',
  capability: 'refund',
  actor,
});
assert.equal(listed.evidence.length, 1);
assert.equal(listed.evidence[0].status, 'UNKNOWN');

console.log('GAP-1.18 provider capability evidence regression passed');
