import assert from 'node:assert/strict';
import {supplierNetworkDiscoveryContract} from '../app/src/supplier-network/discovery-contract.js';
import {getDatabaseForTests,getOrCreateUserByTelegram,createTenantForUser,setProcurementSupplierParticipation,upsertSupplierNetworkProfile,upsertSupplierNetworkCapability,upsertSupplierNetworkCapacity,upsertSupplierNetworkCatalogListing,discoverSupplierNetwork} from '../backend/lib/store-sqlite.js';

const c=supplierNetworkDiscoveryContract();
assert.equal(c.version,'1.0');
assert.equal(c.capability.capability,'supplier-network.discovery');
assert.equal(c.capability.deterministic,true);
assert.equal(c.capability.ai,false);
assert.equal(c.capability.procurementMutation,false);

const db=getDatabaseForTests();
const x=Date.now().toString(36);
const buyerUser=await getOrCreateUserByTelegram('p1810_b_'+x,'Discovery Buyer');
const supplierUser=await getOrCreateUserByTelegram('p1810_s_'+x,'Discovery Supplier');
const buyerTenant=await createTenantForUser({userId:buyerUser.id,sellerName:'P18.10 Buyer '+x,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const supplierTenant=await createTenantForUser({userId:supplierUser.id,sellerName:'P18.10 Supplier '+x,businessType:'wholesale',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const buyer=db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(buyerTenant.chatId);
const supplier=db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(supplierTenant.chatId);
const buyerActor={userId:buyerUser.id,role:'owner',organizationId:buyer.organization_id,chatId:buyer.chat_id};
const supplierActor={userId:supplierUser.id,role:'owner',organizationId:supplier.organization_id,chatId:supplier.chat_id};
await setProcurementSupplierParticipation(supplier.chat_id,{status:'ACTIVE',discoverable:true},supplierActor);
await upsertSupplierNetworkProfile(supplier.chat_id,{displayName:'Kaffa Supply '+x,description:'Wholesale agricultural inputs',businessCategories:['AGRICULTURE','WHOLESALE'],serviceSummary:'Seeds and fertilizer',visibility:'PUBLIC',status:'PUBLISHED'},supplierActor);
const capability=await upsertSupplierNetworkCapability(supplier.chat_id,{code:'WHOLESALE',name:'Wholesale supply',category:'distribution',visibility:'PUBLIC'},supplierActor);
await upsertSupplierNetworkCapacity(supplier.chat_id,{subjectType:'CAPABILITY',subjectId:capability.id,quantity:500,unit:'kg',periodType:'RANGE',periodStart:'2026-12-01T00:00:00.000Z',periodEnd:'2026-12-31T23:59:59.999Z',availability:'AVAILABLE',visibility:'PUBLIC'},supplierActor);
// Reuse a product ID across two tenants. Discovery must resolve the supplier's
// canonical product row only, never the buyer tenant's same-ID product metadata.
const sharedProductId='shared_'+x;
const now=new Date().toISOString();
db.prepare('INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)').run(buyer.chat_id,sharedProductId,JSON.stringify({id:sharedProductId,name:'BUYER PRIVATE PRODUCT'}),100,1,0,now,0,'ETB');
db.prepare('INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)').run(supplier.chat_id,sharedProductId,JSON.stringify({id:sharedProductId,name:'Supplier Canonical Product'}),200,2,0,now,0,'ETB');
await upsertSupplierNetworkCatalogListing(supplier.chat_id,{productId:sharedProductId,description:'Supplier-owned listing',visibility:'PUBLIC',status:'ACTIVE'},supplierActor);

let results=await discoverSupplierNetwork(buyer.chat_id,{search:'Kaffa Supply '+x,limit:10},buyerActor);
assert.equal(results.length,1);
assert.equal(results[0].organizationId,supplier.organization_id);
assert.equal(results[0].catalog.length,1,'discovery must join one canonical catalog row for the supplier tenant');
assert.equal(results[0].catalog[0].productName,'Supplier Canonical Product','discovery must not expose another tenant product metadata when IDs collide');
assert.equal(results[0].deterministic,undefined);
assert.ok(results[0].matchReasons.some(r=>r.dimension==='CAPACITY')===true);
let capacityResults=await discoverSupplierNetwork(buyer.chat_id,{search:'Kaffa Supply '+x,capabilityCode:'WHOLESALE',minimumQuantity:100,limit:10},buyerActor);
assert.equal(capacityResults.length,1,'capability-bound declared capacity is discoverable by canonical capability ID');
assert.equal(capacityResults[0].capacitySignals[0].subjectId,capability.id);
assert.equal(capacityResults[0].capacitySignals[0].periodStart,'2026-12-01T00:00:00.000Z');
await setProcurementSupplierParticipation(supplier.chat_id,{status:'ACTIVE',discoverable:false},supplierActor);
results=await discoverSupplierNetwork(buyer.chat_id,{search:'Kaffa Supply '+x,limit:10},buyerActor);
assert.equal(results.length,0);
await setProcurementSupplierParticipation(supplier.chat_id,{status:'ACTIVE',discoverable:true},supplierActor);
await upsertSupplierNetworkProfile(supplier.chat_id,{displayName:'Kaffa Supply '+x,description:'Wholesale agricultural inputs',businessCategories:['AGRICULTURE','WHOLESALE'],serviceSummary:'Seeds and fertilizer',visibility:'PRIVATE',status:'PUBLISHED'},supplierActor);
results=await discoverSupplierNetwork(buyer.chat_id,{search:'Kaffa Supply '+x,limit:10},buyerActor);
assert.equal(results.length,0);
console.log('Phase 18.10 supplier network discovery regression: PASS');
