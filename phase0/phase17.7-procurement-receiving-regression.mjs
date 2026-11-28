import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const tmp=await mkdtemp(path.join(os.tmpdir(),'sellify-17-7-receiving-')); process.env.SELLIFY_DATA_DIR=tmp; process.env.SELLIFY_DB_PATH=path.join(tmp,'test.sqlite');
const store=await import('../backend/lib/store-sqlite.js');
const {getDatabaseForTests,getOrCreateUserByTelegram,createTenantForUser,setProcurementSupplierParticipation,createProcurementSupplierRelationship,transitionProcurementSupplierRelationship,createProcurementDemand,transitionProcurementDemand,createProcurementRfq,transitionProcurementRfq,createProcurementRfqResponse,transitionProcurementRfqResponse,createProcurementComparison,createProcurementAward,transitionProcurementAward,createPurchaseOrderFromProcurementAward,transitionPurchaseOrder,createProcurementReceipt,listProcurementReceipts}=store;
const db=getDatabaseForTests(); const x=Date.now().toString(36);
async function mk(tag,name){const u=await getOrCreateUserByTelegram(`p177_${tag}_${x}`,name);const t=await createTenantForUser({userId:u.id,sellerName:`${name} ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});const row=db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(t.chatId);return {user:u,tenant:row,actor:{userId:u.id,role:'owner',organizationId:row.organization_id,chatId:row.chat_id}};}
const buyer=await mk('buyer','P177 Buyer'); const supplier=await mk('supplier','P177 Supplier');
await setProcurementSupplierParticipation(supplier.tenant.chat_id,{status:'ACTIVE',discoverable:true},supplier.actor);
const rel=await createProcurementSupplierRelationship(buyer.tenant.chat_id,{supplierOrganizationId:supplier.tenant.organization_id,source:'DIRECT'},buyer.actor); await transitionProcurementSupplierRelationship(buyer.tenant.chat_id,rel.id,'ACTIVE',buyer.actor);
const productId='cement-177'; db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`).run(buyer.tenant.chat_id,productId,JSON.stringify({id:productId,name:'Cement'}),1000,0,0,new Date().toISOString(),0,'ETB');
const location=db.prepare("SELECT id FROM locations WHERE organization_id=? AND status='active' ORDER BY id LIMIT 1").get(buyer.tenant.organization_id); assert.ok(location?.id);
const demand=await createProcurementDemand(buyer.tenant.chat_id,{currency:'ETB',items:[{productId,quantity:100,unit:'bag'}]},buyer.actor); await transitionProcurementDemand(buyer.tenant.chat_id,demand.id,'SUBMITTED',buyer.actor); await transitionProcurementDemand(buyer.tenant.chat_id,demand.id,'SOURCING',buyer.actor);
const rfq=await createProcurementRfq(buyer.tenant.chat_id,{demandId:demand.id,supplierOrganizationIds:[supplier.tenant.organization_id]},buyer.actor); const item=rfq.items[0]; await transitionProcurementRfq(buyer.tenant.chat_id,rfq.id,'SENT',buyer.actor);
const response=await createProcurementRfqResponse(supplier.tenant.chat_id,rfq.id,{currency:'ETB',items:[{rfqItemId:item.id,offeredQuantity:100,unitPriceMinor:1000,leadTimeDays:3}]},supplier.actor); await transitionProcurementRfqResponse(supplier.tenant.chat_id,response.id,'SUBMITTED',supplier.actor); await transitionProcurementRfq(buyer.tenant.chat_id,rfq.id,'CLOSED',buyer.actor);
const comparison=await createProcurementComparison(buyer.tenant.chat_id,rfq.id,buyer.actor); const award=await createProcurementAward(buyer.tenant.chat_id,{demandId:demand.id,rfqId:rfq.id,comparisonId:comparison.id,lines:[{rfqItemId:item.id,supplierOrganizationId:supplier.tenant.organization_id,awardedQuantity:100}]},buyer.actor); await transitionProcurementAward(buyer.tenant.chat_id,award.id,'CONFIRMED',buyer.actor);
const po=await createPurchaseOrderFromProcurementAward(buyer.tenant.chat_id,{procurementAwardId:award.id},buyer.actor); await transitionPurchaseOrder(buyer.tenant.chat_id,po.id,'SUBMITTED',buyer.actor); await transitionPurchaseOrder(buyer.tenant.chat_id,po.id,'APPROVED',buyer.actor);
const before=db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=?").get(buyer.tenant.organization_id,productId,location.id).q;
// A legacy type-only service must be rejected before any receipt or stock effect.
db.prepare('UPDATE catalog_products SET product_json=? WHERE chat_id=? AND product_id=?').run(JSON.stringify({id:productId,name:'Cement',type:'service'}),buyer.tenant.chat_id,productId);
await assert.rejects(()=>createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,idempotencyKey:'receipt-177-legacy-service',items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:1}]},buyer.actor),e=>e?.code==='SERVICE_HAS_NO_INVENTORY');
assert.equal(db.prepare('SELECT COUNT(*) c FROM procurement_receipts WHERE purchase_order_id=?').get(po.id).c,0);
assert.equal(Number(db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=?").get(buyer.tenant.organization_id,productId,location.id).q),Number(before));
// Canonical item_type wins over a conflicting legacy type field.
db.prepare('UPDATE catalog_products SET product_json=? WHERE chat_id=? AND product_id=?').run(JSON.stringify({id:productId,name:'Cement',item_type:'product',type:'service'}),buyer.tenant.chat_id,productId);
const canonicalProductReceipt=await createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,idempotencyKey:'receipt-177-canonical-product',items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:1}]},buyer.actor);
assert.equal(canonicalProductReceipt.status,'POSTED');
const afterCanonicalProduct=Number(db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=?").get(buyer.tenant.organization_id,productId,location.id).q);
assert.equal(afterCanonicalProduct-Number(before),1);
const r1=await createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,idempotencyKey:'receipt-177-a',items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:39}]},buyer.actor);
assert.equal(r1.status,'POSTED'); assert.equal(r1.lines[0].receivedQuantity,39);
const after1=db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=?").get(buyer.tenant.organization_id,productId,location.id).q; assert.equal(Number(after1)-Number(before),40);
const same=await createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,idempotencyKey:'receipt-177-a',items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:39}]},buyer.actor); assert.equal(same.id,r1.id);
 const countAfterRetry=db.prepare("SELECT COUNT(*) c FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=? AND reference_type='procurement_receipt' AND reference_id=?").get(buyer.tenant.organization_id,productId,location.id,r1.id).c; assert.equal(countAfterRetry,1);
await assert.rejects(
  () => createProcurementReceipt(buyer.tenant.chat_id, po.id, {
    locationId: location.id, idempotencyKey: 'receipt-177-a',
    items: [{ purchaseOrderItemId: po.items[0].id, receivedQuantity: 38 }],
  }, buyer.actor),
  e => e?.code === 'IDEMPOTENCY_KEY_REUSED' && e?.statusCode === 409,
  'same idempotency key with changed receipt quantity must conflict',
);
await assert.rejects(()=>createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:61}]},buyer.actor),e=>e?.code==='OVER_RECEIPT');
const r2=await createProcurementReceipt(buyer.tenant.chat_id,po.id,{locationId:location.id,idempotencyKey:'receipt-177-b',items:[{purchaseOrderItemId:po.items[0].id,receivedQuantity:60}]},buyer.actor); assert.equal(r2.lines[0].receivedQuantity,60);
const after2=db.prepare("SELECT COALESCE(SUM(quantity),0) q FROM inventory_movements WHERE organization_id=? AND product_id=? AND location_id=?").get(buyer.tenant.organization_id,productId,location.id).q; assert.equal(Number(after2)-Number(before),100);

// Add two PO lines to prove all receipt movements and the POSTED transition
// remain atomic when a later line fails.
const secondProductId = `${productId}-second`;
db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`)
  .run(buyer.tenant.chat_id, secondProductId, JSON.stringify({id:secondProductId,name:'Cement second'}), 1000, 0, 0, new Date().toISOString(), 0, 'ETB');
const firstBatchItemId = `po-item-${x}-batch-first`;
const secondBatchItemId = `po-item-${x}-batch-second`;
for (const [id, product] of [[firstBatchItemId, productId], [secondBatchItemId, secondProductId]]) {
  db.prepare(`INSERT INTO purchase_order_items(id,purchase_order_id,product_id,description,quantity,unit_price_minor,currency,line_total_minor,quote_item_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(id, po.id, product, `Atomic receipt ${product}`, 10, 1000, 'ETB', 10000, null, new Date().toISOString());
}
const batchReceipt = {
  id: `receipt-atomic-${x}`, locationId: location.id, idempotencyKey: `receipt-atomic-${x}`,
  items: [
    { purchaseOrderItemId: firstBatchItemId, receivedQuantity: 2 },
    { purchaseOrderItemId: secondBatchItemId, receivedQuantity: 3 },
  ],
};
db.exec(`CREATE TRIGGER fail_second_receipt_movement BEFORE INSERT ON inventory_movements
  WHEN NEW.product_id = '${secondProductId}'
  BEGIN SELECT RAISE(ABORT, 'injected second-line failure'); END;`);
await assert.rejects(
  () => createProcurementReceipt(buyer.tenant.chat_id, po.id, batchReceipt, buyer.actor),
  /injected second-line failure/,
);
db.exec('DROP TRIGGER fail_second_receipt_movement');
assert.equal(db.prepare('SELECT status FROM procurement_receipts WHERE id=?').get(batchReceipt.id).status, 'PENDING');
assert.equal(db.prepare('SELECT COUNT(*) c FROM inventory_movements WHERE reference_type=? AND reference_id=?').get('procurement_receipt', batchReceipt.id).c, 0,
  'all Inventory movements must roll back when any receipt line fails');
// Simulate a pre-v2 pending receipt. The legacy hash omits nested line fields,
// so stored immutable lines must be checked before allowing a retry.
const legacyBatchHashInput = {
  purchaseOrderId: po.id, locationId: location.id, receivedAt: null, notes: '',
  items: [
    { purchaseOrderItemId: firstBatchItemId, productId, receivedQuantity: 2, notes: '' },
    { purchaseOrderItemId: secondBatchItemId, productId: secondProductId, receivedQuantity: 3, notes: '' },
  ],
};
const legacyBatchHash = createHash('sha256')
  .update(JSON.stringify(legacyBatchHashInput, Object.keys(legacyBatchHashInput).sort())).digest('hex');
db.prepare('UPDATE procurement_receipts SET request_hash=? WHERE id=?').run(legacyBatchHash, batchReceipt.id);
await assert.rejects(
  () => createProcurementReceipt(buyer.tenant.chat_id, po.id, {
    ...batchReceipt,
    items: [
      { purchaseOrderItemId: firstBatchItemId, receivedQuantity: 1 },
      { purchaseOrderItemId: secondBatchItemId, receivedQuantity: 3 },
    ],
  }, buyer.actor),
  e => e?.code === 'IDEMPOTENCY_KEY_REUSED' && e?.statusCode === 409,
  'legacy hash must not permit changed nested receipt-line quantities',
);
const recoveredReceipt = await createProcurementReceipt(buyer.tenant.chat_id, po.id, batchReceipt, buyer.actor);
assert.equal(recoveredReceipt.id, batchReceipt.id);
assert.equal(recoveredReceipt.status, 'POSTED');
assert.equal(db.prepare('SELECT COUNT(*) c FROM inventory_movements WHERE reference_type=? AND reference_id=?').get('procurement_receipt', batchReceipt.id).c, 2);

// Same-key concurrent retries converge on one PENDING reservation and one movement.
const concurrentReceiptInput = {
  locationId: location.id, idempotencyKey: `receipt-concurrent-${x}`,
  items: [{ purchaseOrderItemId: firstBatchItemId, receivedQuantity: 1 }],
};
const concurrentResults = await Promise.all([
  createProcurementReceipt(buyer.tenant.chat_id, po.id, concurrentReceiptInput, buyer.actor),
  createProcurementReceipt(buyer.tenant.chat_id, po.id, concurrentReceiptInput, buyer.actor),
]);
assert.equal(concurrentResults[0].id, concurrentResults[1].id);
assert.equal(concurrentResults[0].status, 'POSTED');
assert.equal(concurrentResults[1].status, 'POSTED');
assert.equal(db.prepare('SELECT COUNT(*) c FROM inventory_movements WHERE event_id=?')
  .get(`procurement_receipt:${concurrentResults[0].id}:${firstBatchItemId}`).c, 1);

// Competing different-key receipts must count PENDING reservations when
// enforcing the remaining PO quantity. Only one 4-unit receipt can fit.
const competingInputs = ['a', 'b'].map(suffix => ({
  locationId: location.id, idempotencyKey: `receipt-overreceive-${suffix}-${x}`,
  items: [{ purchaseOrderItemId: firstBatchItemId, receivedQuantity: 4 }],
}));
const competingResults = await Promise.allSettled(competingInputs.map(input =>
  createProcurementReceipt(buyer.tenant.chat_id, po.id, input, buyer.actor)
));
assert.equal(competingResults.filter(result => result.status === 'fulfilled').length, 1);
assert.equal(competingResults.filter(result => result.status === 'rejected' && result.reason?.code === 'OVER_RECEIPT').length, 1);

// A posted-receipt audit failure rolls back the inventory movement and leaves
// the durable PENDING receipt available for a same-key retry.
const auditReceiptInput = {
  locationId: location.id, idempotencyKey: `receipt-audit-${x}`,
  items: [{ purchaseOrderItemId: secondBatchItemId, receivedQuantity: 1 }],
};
db.exec(`CREATE TRIGGER fail_procurement_receipt_posted_audit BEFORE INSERT ON audit_events
  WHEN NEW.entity_type = 'procurement_receipt' AND NEW.action = 'procurement.receipt.posted'
  BEGIN SELECT RAISE(ABORT, 'injected receipt audit failure'); END;`);
await assert.rejects(
  () => createProcurementReceipt(buyer.tenant.chat_id, po.id, auditReceiptInput, buyer.actor),
  /injected receipt audit failure/,
);
db.exec('DROP TRIGGER fail_procurement_receipt_posted_audit');
const auditPending = db.prepare('SELECT id,status FROM procurement_receipts WHERE idempotency_key=?').get(auditReceiptInput.idempotencyKey);
assert.equal(auditPending.status, 'PENDING');
assert.equal(db.prepare('SELECT COUNT(*) c FROM inventory_movements WHERE reference_type=? AND reference_id=?').get('procurement_receipt', auditPending.id).c, 0);
const auditRecovered = await createProcurementReceipt(buyer.tenant.chat_id, po.id, auditReceiptInput, buyer.actor);
assert.equal(auditRecovered.id, auditPending.id);
assert.equal(auditRecovered.status, 'POSTED');

const receipts=await listProcurementReceipts(buyer.tenant.chat_id,{purchaseOrderId:po.id},buyer.actor); assert.equal(receipts.length,7); assert.equal(db.prepare("SELECT COUNT(*) c FROM procurement_receipt_lines").get().c,8); assert.equal(db.prepare("SELECT COUNT(*) c FROM payments").get().c,0); assert.equal(db.prepare("SELECT COUNT(*) c FROM accounts_receivable").get().c,0);
console.log('Phase 17.7 Procurement Receiving Regression: PASS');
