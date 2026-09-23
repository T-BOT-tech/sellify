import assert from 'node:assert/strict';
import { getDatabaseForTests, getOrCreateUserByTelegram, createTenantForUser, setProcurementSupplierParticipation, createProcurementSupplierRelationship, transitionProcurementSupplierRelationship, createProcurementDemand, transitionProcurementDemand, createProcurementRfq, transitionProcurementRfq, createProcurementRfqResponse, transitionProcurementRfqResponse, createProcurementComparison, getProcurementComparison, listProcurementComparisons } from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const mk = async (tag, name) => {
  const u = await getOrCreateUserByTelegram(`p174_${tag}_${x}`, name);
  const t = await createTenantForUser({ userId: u.id, sellerName: `${name} ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
  const row = db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(t.chatId);
  return { user: u, tenant: row, actor: { userId: u.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id } };
};
const buyer = await mk('buyer', 'P174 Buyer');
const s1 = await mk('s1', 'P174 Supplier A');
const s2 = await mk('s2', 'P174 Supplier B');
for (const s of [s1, s2]) await setProcurementSupplierParticipation(s.tenant.chat_id, { status: 'ACTIVE', discoverable: true }, s.actor);
for (const s of [s1, s2]) {
  const rel = await createProcurementSupplierRelationship(buyer.tenant.chat_id, { supplierOrganizationId: s.tenant.organization_id, source: 'DIRECT' }, buyer.actor);
  await transitionProcurementSupplierRelationship(buyer.tenant.chat_id, rel.id, 'ACTIVE', buyer.actor);
}
const demand = await createProcurementDemand(buyer.tenant.chat_id, { currency: 'ETB', items: [
  { description: 'Cement', specification: 'Grade 42.5', quantity: 100, unit: 'bag', currency: 'ETB' },
  { description: 'Steel', specification: '12mm', quantity: 50, unit: 'bar', currency: 'ETB' },
] }, buyer.actor);
await transitionProcurementDemand(buyer.tenant.chat_id, demand.id, 'SUBMITTED', buyer.actor);
await transitionProcurementDemand(buyer.tenant.chat_id, demand.id, 'SOURCING', buyer.actor);
const rfq = await createProcurementRfq(buyer.tenant.chat_id, { demandId: demand.id, supplierOrganizationIds: [s1.tenant.organization_id, s2.tenant.organization_id] }, buyer.actor);
const steelItem = rfq.items.find(i => i.description === 'Steel');
const cementItem = rfq.items.find(i => i.description === 'Cement');
assert.ok(steelItem && cementItem);
await transitionProcurementRfq(buyer.tenant.chat_id, rfq.id, 'SENT', buyer.actor);
const r1 = await createProcurementRfqResponse(s1.tenant.chat_id, rfq.id, { currency: 'ETB', items: [
  { rfqItemId: steelItem.id, offeredQuantity: steelItem.quantity, unitPriceMinor: 30000, leadTimeDays: 5 },
  { rfqItemId: cementItem.id, offeredQuantity: cementItem.quantity, unitPriceMinor: 9000, leadTimeDays: 5 },
] }, s1.actor);
await transitionProcurementRfqResponse(s1.tenant.chat_id, r1.id, 'SUBMITTED', s1.actor);
const r2 = await createProcurementRfqResponse(s2.tenant.chat_id, rfq.id, { currency: 'ETB', items: [
  { rfqItemId: cementItem.id, offeredQuantity: cementItem.quantity, unitPriceMinor: 8000, leadTimeDays: 10 },
] }, s2.actor);
await transitionProcurementRfqResponse(s2.tenant.chat_id, r2.id, 'SUBMITTED', s2.actor);
await assert.rejects(() => createProcurementComparison(buyer.tenant.chat_id, rfq.id, buyer.actor), /CLOSED/);
await transitionProcurementRfq(buyer.tenant.chat_id, rfq.id, 'CLOSED', buyer.actor);
const comparison = await createProcurementComparison(buyer.tenant.chat_id, rfq.id, buyer.actor);
assert.equal(comparison.version, 1);
assert.equal(comparison.suppliers.length, 2);
assert.equal(comparison.suppliers[0].supplierOrganizationId, s1.tenant.organization_id);
assert.equal(comparison.suppliers[0].completeCoverage, true);
assert.equal(comparison.suppliers[0].comparableTotalMinor, 2400000);
assert.equal(comparison.suppliers[1].completeCoverage, false);
assert.equal(comparison.suppliers[1].coverageRatio, 100 / 150);
assert.equal(comparison.lines.length, 3);
const steel = comparison.lines.find(x => x.rfqItemId === steelItem.id);
assert.equal(steel.supplierOrganizationId, s1.tenant.organization_id);
assert.equal(steel.comparableLineTotalMinor, 1500000);
const second = await createProcurementComparison(buyer.tenant.chat_id, rfq.id, buyer.actor);
assert.equal(second.version, 2);
assert.equal((await listProcurementComparisons(buyer.tenant.chat_id, { rfqId: rfq.id }, buyer.actor)).length, 2);
assert.equal((await getProcurementComparison(buyer.tenant.chat_id, comparison.id, buyer.actor)).id, comparison.id);
assert.equal(db.prepare('SELECT COUNT(*) c FROM quotes').get()?.c ?? 0, 0);
console.log('Phase 17.4 Deterministic Comparison Regression: PASS');
