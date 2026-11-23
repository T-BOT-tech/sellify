import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-customer-patch-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(`customer-patch-${Date.now()}`, 'Customer Patch Regression');
  const tenant = await store.createTenantForUser({
    userId: user.id, sellerName: 'Customer Patch Regression',
    country: 'ET', currency: 'ETB',
  });

  const created = await store.upsertCustomer(tenant.chatId, {
    name: 'Original Customer', phone: '0900000001', customerType: 'retail',
  });
  const patched = await store.updateCustomer(tenant.chatId, created.id, {
    customer_name: 'Updated Business',
    customer_phone: '0900000002',
    customer_type: 'business',
  });

  assert.equal(patched.name, 'Updated Business');
  assert.equal(patched.phone, '0900000002');
  assert.equal(patched.customerType, 'business');

  const canonicalWins = await store.updateCustomer(tenant.chatId, created.id, {
    customerType: 'retail',
    customer_type: 'business',
  });
  assert.equal(canonicalWins.customerType, 'retail');

  console.log('Customer PATCH snake_case alias regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
