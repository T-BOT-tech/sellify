import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const tmp=await mkdtemp(path.join(os.tmpdir(),'sellify-17-6-po-')); process.env.SELLIFY_DATA_DIR=tmp; process.env.SELLIFY_DB_PATH=path.join(tmp,'test.sqlite');
const store=await import('../backend/lib/store-sqlite.js');
const {getDatabaseForTests,getOrCreateUserByTelegram,createTenantForUser,setProcurementSupplierParticipation,createProcurementSupplierRelationship,transitionProcurementSupplierRelationship,createProcurementDemand,transitionProcurementDemand,createProcurementRfq,transitionProcurementRfq,createProcurementRfqResponse,transitionProcurementRfqResponse,createProcurementComparison,createProcurementAward,transitionProcurementAward,createPurchaseOrderFromProcurementAward}=store;
const db=getDatabaseForTests(); const x=Date.now().toString(36);
async function mk(tag,name){const u=await getOrCreateUserByTelegram(`p176_${tag}_${x}`,name);const t=await createTenantForUser({userId:u.id,sellerName:`${name} ${x}`,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});const row=db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(t.chatId);return {user:u,tenant:row,actor:{userId:u.id,role:'owner',organizationId:row.organization_id,chatId:row.chat_id}};}
const buyer=await mk('buyer','P176 Buyer'); const a=await mk('a','P176 Supplier A'); const b=await mk('b','P176 Supplier B');
for(const s of [a,b]) await setProcurementSupplierParticipation(s.tenant.chat_id,{status:'ACTIVE',discoverable:true},s.actor);
for(const s of [a,b]) {const rel=await createProcurementSupplierRelationship(buyer.tenant.chat_id,{supplierOrganizationId:s.tenant.organization_id,source:'DIRECT'},buyer.actor);await transitionProcurementSupplierRelationship(buyer.tenant.chat_id,rel.id,'ACTIVE',buyer.actor);}
const productId='cement-176'; db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`).run(buyer.tenant.chat_id,productId,JSON.stringify({id:productId,name:'Cement'}),1000,0,0,new Date().toISOString(),0,'ETB');
const demand=await createProcurementDemand(buyer.tenant.chat_id,{currency:'ETB',items:[{productId,quantity:100,unit:'bag'}]},buyer.actor); await transitionProcurementDemand(buyer.tenant.chat_id,demand.id,'SUBMITTED',buyer.actor); await transitionProcurementDemand(buyer.tenant.chat_id,demand.id,'SOURCING',buyer.actor);
const rfq=await createProcurementRfq(buyer.tenant.chat_id,{demandId:demand.id,supplierOrganizationIds:[a.tenant.organization_id,b.tenant.organization_id]},buyer.actor); const item=rfq.items[0]; await transitionProcurementRfq(buyer.tenant.chat_id,rfq.id,'SENT',buyer.actor);
const ra=await createProcurementRfqResponse(a.tenant.chat_id,rfq.id,{currency:'ETB',items:[{rfqItemId:item.id,offeredQuantity:100,unitPriceMinor:1000,leadTimeDays:5}]},a.actor); await transitionProcurementRfqResponse(a.tenant.chat_id,ra.id,'SUBMITTED',a.actor);
const rb=await createProcurementRfqResponse(b.tenant.chat_id,rfq.id,{currency:'ETB',items:[{rfqItemId:item.id,offeredQuantity:50,unitPriceMinor:800,leadTimeDays:3}]},b.actor); await transitionProcurementRfqResponse(b.tenant.chat_id,rb.id,'SUBMITTED',b.actor);
await transitionProcurementRfq(buyer.tenant.chat_id,rfq.id,'CLOSED',buyer.actor); const comparison=await createProcurementComparison(buyer.tenant.chat_id,rfq.id,buyer.actor);
const award=await createProcurementAward(buyer.tenant.chat_id,{demandId:demand.id,rfqId:rfq.id,comparisonId:comparison.id,lines:[{rfqItemId:item.id,supplierOrganizationId:b.tenant.organization_id,awardedQuantity:50},{rfqItemId:item.id,supplierOrganizationId:a.tenant.organization_id,awardedQuantity:50}]},buyer.actor); await transitionProcurementAward(buyer.tenant.chat_id,award.id,'CONFIRMED',buyer.actor);
await assert.rejects(()=>createPurchaseOrderFromProcurementAward(buyer.tenant.chat_id,{procurementAwardId:award.id},buyer.actor),e=>e?.code==='SPLIT_AWARD_REQUIRES_SEPARATE_POS');
const poB=await createPurchaseOrderFromProcurementAward(buyer.tenant.chat_id,{procurementAwardId:award.id,supplierOrganizationId:b.tenant.organization_id},buyer.actor);
const poA=await createPurchaseOrderFromProcurementAward(buyer.tenant.chat_id,{procurementAwardId:award.id,supplierOrganizationId:a.tenant.organization_id},buyer.actor);
assert.equal(poB.sourceType,'PROCUREMENT_AWARD'); assert.equal(poB.customerId,null); assert.equal(poB.quoteId,null); assert.equal(poB.supplierOrganizationId,b.tenant.organization_id); assert.equal(poB.totalMinor,40000); assert.equal(poB.items[0].productId,productId);
assert.equal(poA.totalMinor,50000); assert.notEqual(poA.id,poB.id);
await assert.rejects(()=>createPurchaseOrderFromProcurementAward(buyer.tenant.chat_id,{procurementAwardId:award.id,supplierOrganizationId:b.tenant.organization_id},buyer.actor),e=>e?.code==='PO_ALREADY_EXISTS');
assert.equal(db.prepare("SELECT COUNT(*) c FROM purchase_orders WHERE organization_id=? AND source_type='PROCUREMENT_AWARD'").get(buyer.tenant.organization_id).c,2);
console.log('Phase 17.6 Procurement PO Bridge Regression: PASS');
