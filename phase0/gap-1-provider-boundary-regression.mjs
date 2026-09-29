import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listPaymentProviders } from '../backend/lib/payments/provider-registry.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const providerDir = path.resolve(root, '../backend/lib/payments/providers');
const files = fs.readdirSync(providerDir).filter(name => name.endsWith('.js'));

for (const file of files) {
  const source = fs.readFileSync(path.join(providerDir, file), 'utf8');
  for (const forbidden of ['store-sqlite', 'commitPaymentDecision', 'transitionPayment(', 'payment_ledger_entries']) {
    assert.equal(source.includes(forbidden), false, `${file} must not bypass Payment Core via ${forbidden}`);
  }
}

const providers = listPaymentProviders();
for (const id of ['telebirr', 'cbe', 'mpesa', 'boa']) {
  const provider = providers.find(item => item.id === id);
  assert.ok(provider, `${id} must be registered`);
  assert.equal(provider.capabilities.parseEvidence, true);
}

console.log('GAP-1 provider boundary regression: PASS');
