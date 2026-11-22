#!/usr/bin/env node
/**
 * Temporary Phase 18.5 capacity regression probe.
 *
 * Runs one narrowly scoped invariant per invocation so CI can identify the
 * exact failing behavior without modifying production capacity logic.
 */

import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const probe = process.argv[2];
if (!probe) {
  console.error('Usage: node phase0/capacity-diagnostic-probe.mjs <probe>');
  process.exit(2);
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-capacity-probe-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'capacity-probe.sqlite');

const {
  supplierNetworkCapacityContract,
} = await import('../app/src/supplier-network/capacity-contract.js');

const store = await import('../backend/lib/store-sqlite.js');
const {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  setProcurementSupplierParticipation,
  upsertSupplierNetworkCapacity,
  getSupplierNetworkCapacity,
  transitionSupplierNetworkCapacity,
} = store;

const db = getDatabaseForTests();
const stamp = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`probe_${stamp}`, 'Capacity Probe Supplier');
const tenant = await createTenantForUser({
  userId: user.id,
  sellerName: `Capacity Probe ${stamp}`,
  businessType: 'retail',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const tenantRow = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId);
const actor = {
  userId: user.id,
  role: 'owner',
  organizationId: tenantRow.organization_id,
  chatId: tenantRow.chat_id,
};

const periodStart = new Date(Date.now() - 86400000).toISOString();
const periodEnd = new Date(Date.now() + 7 * 86400000).toISOString();
const validUntil = new Date(Date.now() + 86400000).toISOString();

async function createValidCapacity() {
  return upsertSupplierNetworkCapacity(tenantRow.chat_id, {
    subjectType: 'PRODUCT',
    subjectId: `product-${stamp}`,
    quantity: 1000,
    unit: 'kg',
    periodType: 'MONTH',
    periodStart,
    periodEnd,
    availability: 'LIMITED',
    visibility: 'NETWORK',
    validUntil,
  }, actor);
}

const errorSignatures = [
  'is not a function',
  'no such table',
  'no such column',
  'subject type',
  'period',
  'positive',
  'availability',
  'validUntil',
  'participation',
  'authorization',
  'capacity',
  'Cannot read properties',
];

switch (probe) {
  case 'contract': {
    const contract = supplierNetworkCapacityContract();
    assert.equal(contract.version, '1.0');
    assert.equal(contract.capability.capability, 'supplier-network.capacity');
    assert.equal(contract.capability.source, 'DECLARED_ONLY');
    assert.equal(contract.capability.procurementMutation, false);
    assert.deepEqual(contract.subjectTypes, ['PRODUCT', 'CAPABILITY']);
    break;
  }
  case 'database': {
    assert.ok(db);
    assert.equal(typeof db.prepare, 'function');
    break;
  }
  case 'tenant': {
    assert.ok(user?.id);
    assert.ok(tenant?.chatId);
    assert.ok(tenantRow?.organization_id);
    break;
  }
  case 'participation': {
    await setProcurementSupplierParticipation(tenantRow.chat_id, { status: 'ACTIVE', discoverable: true }, actor);
    break;
  }
  case 'upsert-valid': {
    const capacity = await createValidCapacity();
    assert.equal(capacity.quantity, 1000);
    assert.equal(capacity.source, 'DECLARED');
    assert.equal(capacity.status, 'ACTIVE');
    assert.equal(capacity.version, 1);
    assert.ok(capacity.observedAt);
    assert.equal(new Date(capacity.observedAt).toISOString(), capacity.observedAt);
    assert.equal(capacity.validUntil, validUntil);
    break;
  }
  case 'reject-quantity': {
    await assert.rejects(() => upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: 'x',
      unit: 'kg',
      quantity: 0,
    }, actor), /positive/i);
    break;
  }
  case 'reject-period': {
    await assert.rejects(() => upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: 'x',
      unit: 'kg',
      quantity: 10,
      periodStart: '2026-09-10',
      periodEnd: '2026-09-01',
    }, actor), /period/i);
    break;
  }
  case 'reject-availability': {
    await assert.rejects(() => upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: 'x',
      quantity: 10,
      unit: 'kg',
      availability: 'BAD',
    }, actor), /Invalid capacity availability/i);
    break;
  }
  case 'reject-expired-validuntil': {
    await assert.rejects(() => upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: 'expired',
      quantity: 10,
      unit: 'kg',
      validUntil: '2000-01-01T00:00:00Z',
    }, actor), /validUntil must not be earlier/i);
    break;
  }
  case 'update-preserves-expiry': {
    const created = await createValidCapacity();
    const updated = await upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: created.subjectId,
      quantity: 1200,
      unit: 'kg',
      periodType: 'MONTH',
      periodStart,
      periodEnd,
    }, actor);
    assert.equal(updated.id, created.id);
    assert.equal(updated.version, 2);
    assert.equal(updated.validUntil, validUntil);
    break;
  }
  case 'clear-expiry': {
    const created = await createValidCapacity();
    const cleared = await upsertSupplierNetworkCapacity(tenantRow.chat_id, {
      subjectType: 'PRODUCT',
      subjectId: created.subjectId,
      quantity: 1200,
      unit: 'kg',
      periodType: 'MONTH',
      periodStart,
      periodEnd,
      validUntil: null,
    }, actor);
    assert.equal(cleared.validUntil, null);
    assert.equal(cleared.version, 3);
    break;
  }
  case 'lifecycle': {
    const created = await createValidCapacity();
    const inactive = await transitionSupplierNetworkCapacity(tenantRow.chat_id, created.id, 'INACTIVE', actor);
    assert.equal(inactive.status, 'INACTIVE');
    assert.equal(inactive.observedAt, created.observedAt);
    const active = await transitionSupplierNetworkCapacity(tenantRow.chat_id, created.id, 'ACTIVE', actor);
    assert.equal(active.status, 'ACTIVE');
    assert.equal(active.observedAt, created.observedAt);
    break;
  }
  default: {
    const match = probe.match(/^error-(\d+)$/);
    if (!match) {
      console.error(`Unknown probe: ${probe}`);
      process.exit(2);
    }
    const signature = errorSignatures[Number(match[1])];
    if (signature === undefined) {
      console.error(`Unknown error signature index: ${match[1]}`);
      process.exit(2);
    }
    let thrown;
    try {
      await createValidCapacity();
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, 'capacity upsert did not throw an error');
    const message = String(thrown?.message ?? thrown);
    assert.ok(
      message.toLowerCase().includes(signature.toLowerCase()),
      `error message does not contain signature "${signature}": ${message}`
    );
    break;
  }
}

console.log(`Capacity probe passed: ${probe}`);
