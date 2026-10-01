import assert from 'node:assert/strict';
import { PROVIDER_ADAPTERS } from '../backend/lib/payments/provider-adapters.js';

for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const provider = PROVIDER_ADAPTERS[id];
  assert.ok(provider);
  assert.equal(provider.capabilities.probeCapability, true);
  const result = await provider.probeCapability({ capability: 'refund', context: { env: {} } });
  assert.equal(result.status, 'UNKNOWN');
  assert.ok(result.reasonCodes.includes('PROVIDER_PROBE_PATH_NOT_CONFIGURED') || result.reasonCodes.includes('PAYMENT_PROVIDER_NOT_CONFIGURED'));
}

console.log('GAP-1.18 provider adapter skeleton regression passed');
