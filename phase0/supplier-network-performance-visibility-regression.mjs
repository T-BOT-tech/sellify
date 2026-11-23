import assert from 'node:assert/strict';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  setProcurementSupplierParticipation,
  createProcurementSupplierRelationship,
  transitionProcurementSupplierRelationship,
  listSupplierNetworkPerformance,
  getSupplierNetworkPerformance,
  recalculateSupplierNetworkPerformance,
} from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const stamp = String(Date.now());

async function tenant(prefix, name) {
  const user = await getOrCreateUserByTelegram('performance-visibility-' + prefix + '-' + stamp, name);
  const created = await createTenantForUser({
    userId: user.id,
    sellerName: name + ' ' + stamp,
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const row = db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(created.chatId);
  return {
    chatId: row.chat_id,
    organizationId: row.organization_id,
    actor: { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id },
  };
}

const buyer = await tenant('buyer', 'Performance Visibility Buyer');
const supplier = await tenant('supplier', 'Performance Visibility Supplier');
await setProcurementSupplierParticipation(supplier.chatId, {
  status: 'ACTIVE',
  discoverable: true,
}, supplier.actor);

await recalculateSupplierNetworkPerformance(
  supplier.chatId,
  supplier.organizationId,
  { days: 30, visibility: 'PRIVATE' },
  supplier.actor,
);
const privateRows = db.prepare("SELECT id FROM supplier_network_performance_observations WHERE supplier_organization_id=? AND visibility='PRIVATE'").all(supplier.organizationId);
await recalculateSupplierNetworkPerformance(
  supplier.chatId,
  supplier.organizationId,
  { days: 30, visibility: 'RELATIONSHIP' },
  supplier.actor,
);
const relationshipRows = db.prepare("SELECT id FROM supplier_network_performance_observations WHERE supplier_organization_id=? AND visibility='RELATIONSHIP'").all(supplier.organizationId);
await recalculateSupplierNetworkPerformance(
  supplier.chatId,
  supplier.organizationId,
  { days: 30, visibility: 'NETWORK' },
  supplier.actor,
);
const networkRows = db.prepare("SELECT id FROM supplier_network_performance_observations WHERE supplier_organization_id=? AND visibility='NETWORK'").all(supplier.organizationId);
assert.equal(privateRows.length, 5);
assert.equal(relationshipRows.length, 5);
assert.equal(networkRows.length, 5);

const buyerBeforeRelationship = await listSupplierNetworkPerformance(
  buyer.chatId,
  { supplierOrganizationId: supplier.organizationId, limit: 100 },
  buyer.actor,
);
assert.equal(buyerBeforeRelationship.length, 5, 'without a relationship, buyers see NETWORK observations only');
assert.ok(buyerBeforeRelationship.every(row => row.visibility === 'NETWORK'));
assert.equal(await getSupplierNetworkPerformance(buyer.chatId, privateRows[0].id, buyer.actor), null,
  'PRIVATE performance observations must not be readable cross-tenant');
assert.equal(await getSupplierNetworkPerformance(buyer.chatId, relationshipRows[0].id, buyer.actor), null,
  'RELATIONSHIP performance observations require an active relationship');
assert.equal((await getSupplierNetworkPerformance(buyer.chatId, networkRows[0].id, buyer.actor)).visibility, 'NETWORK');

const relationship = await createProcurementSupplierRelationship(buyer.chatId, {
  supplierOrganizationId: supplier.organizationId,
  source: 'DIRECT',
}, buyer.actor);
await transitionProcurementSupplierRelationship(buyer.chatId, relationship.id, 'ACTIVE', buyer.actor);

const buyerAfterRelationship = await listSupplierNetworkPerformance(
  buyer.chatId,
  { supplierOrganizationId: supplier.organizationId, limit: 100 },
  buyer.actor,
);
assert.equal(buyerAfterRelationship.length, 10, 'an active relationship adds RELATIONSHIP observations but never PRIVATE observations');
assert.ok(buyerAfterRelationship.every(row => row.visibility !== 'PRIVATE'));
assert.equal((await getSupplierNetworkPerformance(buyer.chatId, relationshipRows[0].id, buyer.actor)).visibility, 'RELATIONSHIP');
assert.equal(await getSupplierNetworkPerformance(buyer.chatId, privateRows[0].id, buyer.actor), null);

const supplierOwnRows = await listSupplierNetworkPerformance(
  supplier.chatId,
  { supplierOrganizationId: supplier.organizationId, limit: 100 },
  supplier.actor,
);
assert.equal(supplierOwnRows.length, 15, 'supplier organization retains access to all of its own performance observations');

// A buyer relationship grants read visibility, not authority to recalculate
// and write observations into another supplier organization's authority.
await assert.rejects(
  () => recalculateSupplierNetworkPerformance(
    buyer.chatId,
    supplier.organizationId,
    { days: 30, visibility: 'NETWORK' },
    buyer.actor,
  ),
  error => error?.statusCode === 403 && error?.code === 'SUPPLIER_PERFORMANCE_SCOPE_FORBIDDEN',
);

assert.equal(
  db.prepare('SELECT COUNT(*) AS count FROM supplier_network_performance_observations WHERE supplier_organization_id=?').get(supplier.organizationId).count,
  15,
  'cross-tenant recalculation denial must not append supplier performance observations',
);

console.log('Supplier Network performance visibility and ownership regression: PASS');
console.log('NETWORK, RELATIONSHIP and PRIVATE read boundaries: PASS');
console.log('Cross-tenant performance recalculation: DENIED');
