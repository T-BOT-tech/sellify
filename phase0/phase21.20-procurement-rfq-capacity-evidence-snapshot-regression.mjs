import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  saveCatalog,
  setProcurementSupplierParticipation,
  createProcurementSupplierRelationship,
  transitionProcurementSupplierRelationship,
  createProcurementDemand,
  transitionProcurementDemand,
  upsertSupplierNetworkCapacity,
  createProcurementRfq,
  listProcurementRfqs,
} from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const stamp = Date.now().toString(36);
async function tenant(prefix, name) {
  const user = await getOrCreateUserByTelegram(`p2120_${prefix}_${stamp}`, name);
  const created = await createTenantForUser({
    userId: user.id, sellerName: `${name} ${stamp}`, businessType: 'retail',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  const row = db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(created.chatId);
  return {
    chatId: row.chat_id,
    organizationId: row.organization_id,
    actor: { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id },
  };
}

const buyer = await tenant('buyer', 'RFQ Snapshot Buyer');
const supplier = await tenant('supplier', 'RFQ Snapshot Supplier');
const productId = `cement-${stamp}`;
await saveCatalog(buyer.chatId, [{ id: productId, name: 'Cement', price: 1200, stock: 10 }]);
await setProcurementSupplierParticipation(supplier.chatId, { status: 'ACTIVE', discoverable: true }, supplier.actor);
const relationship = await createProcurementSupplierRelationship(buyer.chatId, {
  supplierOrganizationId: supplier.organizationId, source: 'DIRECT',
}, buyer.actor);
await transitionProcurementSupplierRelationship(buyer.chatId, relationship.id, 'ACTIVE', buyer.actor);

const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const currentSignal = await upsertSupplierNetworkCapacity(supplier.chatId, {
  subjectType: 'PRODUCT', subjectId: productId, quantity: 500, unit: 'bag',
  availability: 'AVAILABLE', visibility: 'NETWORK', validUntil,
}, supplier.actor);
const privateSignal = await upsertSupplierNetworkCapacity(supplier.chatId, {
  subjectType: 'PRODUCT', subjectId: productId, quantity: 999, unit: 'bag',
  availability: 'AVAILABLE', visibility: 'PRIVATE', validUntil,
  periodType: 'MONTHLY', periodStart: '2026-11-01', periodEnd: '2026-11-30',
}, supplier.actor);
const legacySignal = await upsertSupplierNetworkCapacity(supplier.chatId, {
  subjectType: 'PRODUCT', subjectId: productId, quantity: 250, unit: 'bag',
  availability: 'LIMITED', visibility: 'NETWORK', validUntil,
  periodType: 'WEEKLY', periodStart: '2026-11-22', periodEnd: '2026-11-28',
}, supplier.actor);
db.prepare('UPDATE supplier_network_capacity_signals SET observed_at=NULL WHERE id=?').run(legacySignal.id);

const demand = await createProcurementDemand(buyer.chatId, {
  currency: 'ETB',
  items: [{ productId, quantity: 100, unit: 'bag' }],
}, buyer.actor);
await transitionProcurementDemand(buyer.chatId, demand.id, 'SUBMITTED', buyer.actor);
await transitionProcurementDemand(buyer.chatId, demand.id, 'SOURCING', buyer.actor);

const idempotencyKey = `rfq-capacity-snapshot-${stamp}`;
const rfq = await createProcurementRfq(buyer.chatId, {
  demandId: demand.id,
  supplierOrganizationIds: [supplier.organizationId],
  idempotencyKey,
  capacityEvidenceSnapshot: [{ source: 'client', quality: 'VERIFIED', fake: true }],
}, buyer.actor);
assert.equal(rfq.status, 'DRAFT');
assert.equal(rfq.suppliers.length, 1);
const supplierRfq = rfq.suppliers[0];
assert.ok(supplierRfq.capacityEvidenceCapturedAt, 'snapshot capture time is persisted');
assert.equal(supplierRfq.capacityEvidenceSnapshot.length, 2, 'only matching, buyer-visible product signals are captured');
assert.equal(supplierRfq.capacityEvidenceSnapshot.some(item => item.fake), false, 'client-supplied evidence is ignored');
const current = supplierRfq.capacityEvidenceSnapshot.find(item => item.signalId === currentSignal.id);
const legacy = supplierRfq.capacityEvidenceSnapshot.find(item => item.signalId === legacySignal.id);
assert.ok(current);
assert.ok(legacy);
assert.equal(current.quantity, 500);
assert.equal(current.quality, 'SELF_REPORTED');
assert.equal(current.freshness, 'CURRENT');
assert.equal(current.sourceAuthority, 'supplier_network');
assert.deepEqual(current.relevantDemandItemIds, [rfq.items[0].demandItemId]);
assert.equal(legacy.quantity, 250);
assert.equal(legacy.quality, 'UNKNOWN');
assert.equal(legacy.freshness, 'UNKNOWN');
assert.equal(supplierRfq.capacityEvidenceSnapshot.some(item => item.signalId === privateSignal.id), false, 'PRIVATE supplier evidence is not disclosed');

const snapshotBeforeUpdate = structuredClone(supplierRfq.capacityEvidenceSnapshot);
await upsertSupplierNetworkCapacity(supplier.chatId, {
  id: currentSignal.id,
  subjectType: 'PRODUCT',
  subjectId: productId,
  quantity: 900,
  unit: 'bag',
  availability: 'AVAILABLE',
  visibility: 'NETWORK',
  validUntil,
}, supplier.actor);
const reloaded = (await listProcurementRfqs(buyer.chatId, {}, buyer.actor)).find(item => item.id === rfq.id);
assert.deepEqual(reloaded.suppliers[0].capacityEvidenceSnapshot, snapshotBeforeUpdate, 'RFQ evidence snapshot is immutable after supplier declarations change');

const replay = await createProcurementRfq(buyer.chatId, {
  demandId: demand.id,
  supplierOrganizationIds: [supplier.organizationId],
  idempotencyKey,
}, buyer.actor);
assert.deepEqual(replay.suppliers[0].capacityEvidenceSnapshot, snapshotBeforeUpdate, 'idempotent RFQ replay returns original evidence snapshot');

const columns = new Set(db.prepare('PRAGMA table_info(procurement_rfq_suppliers)').all().map(row => row.name));
assert.equal(columns.has('capacity_evidence_snapshot_json'), true);
assert.equal(columns.has('capacity_evidence_captured_at'), true);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version=85').get().count, 1);

const ui = fs.readFileSync(new URL('../app/src/procurement/ui.js', import.meta.url), 'utf8');
assert.match(ui, /capacityEvidenceSnapshot/);
assert.match(ui, /capacityEvidenceCapturedAt/);
assert.match(ui, /No matching visible product-capacity evidence at RFQ creation/);
assert.match(ui, /read-only snapshot of supplier declarations/);
console.log('Phase 21.20 Procurement RFQ Capacity Evidence Snapshot Regression: PASS');
