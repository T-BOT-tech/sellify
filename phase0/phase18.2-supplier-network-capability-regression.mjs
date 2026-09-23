import assert from 'node:assert/strict';
import {
  getDatabaseForTests, getOrCreateUserByTelegram, createTenantForUser,
  setProcurementSupplierParticipation,
  listSupplierNetworkCapabilities, getSupplierNetworkCapability,
  upsertSupplierNetworkCapability, transitionSupplierNetworkCapability,
} from '../backend/lib/store-sqlite.js';
import { supplierNetworkCapabilityContract, canTransitionSupplierNetworkCapability } from '../app/src/supplier-network/capability-contract.js';

const contract = supplierNetworkCapabilityContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.identityAuthority, 'organizations');
assert.equal(contract.supplierParticipationAuthority, 'procurement');
assert.equal(contract.capability.capability, 'supplier-network.capability');
assert.equal(contract.productAuthority, 'existing product/catalog authority');
assert.equal(contract.procurementMutation, false);
assert.equal(canTransitionSupplierNetworkCapability('ACTIVE','INACTIVE'), true);
assert.equal(canTransitionSupplierNetworkCapability('INACTIVE','ACTIVE'), true);
assert.equal(canTransitionSupplierNetworkCapability('ACTIVE','ACTIVE'), false);

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram('p182_' + x, 'Supplier Capability');
const tenant = await createTenantForUser({userId:user.id,sellerName:'P18.2 Supplier '+x,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const org = db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
const actor = {userId:user.id,role:'owner',organizationId:org.organization_id,chatId:org.chat_id};
await setProcurementSupplierParticipation(org.chat_id,{status:'ACTIVE',discoverable:false},actor);

assert.deepEqual(await listSupplierNetworkCapabilities(org.chat_id), []);
const created = await upsertSupplierNetworkCapability(org.chat_id,{code:'wholesale',name:'Wholesale Supply',category:'distribution',description:'Bulk supply',metadata:{minimumOrderQuantity:100,unit:'bags'},visibility:'NETWORK'},actor);
assert.equal(created.code,'WHOLESALE');
assert.equal(created.status,'ACTIVE');
assert.equal(created.source,'DECLARED');
assert.deepEqual(created.metadata,{minimumOrderQuantity:100,unit:'bags'});
assert.equal(created.version,1);

const fetched = await getSupplierNetworkCapability(org.chat_id,created.id);
assert.equal(fetched.id,created.id);
assert.equal(fetched.organizationId,org.organization_id);

const updated = await upsertSupplierNetworkCapability(org.chat_id,{id:created.id,code:'wholesale',name:'Wholesale & Bulk Supply',category:'distribution',metadata:{minimumOrderQuantity:200},visibility:'PUBLIC'},actor);
assert.equal(updated.version,2);
assert.equal(updated.name,'Wholesale & Bulk Supply');
assert.equal(updated.visibility,'PUBLIC');

const inactive = await transitionSupplierNetworkCapability(org.chat_id,created.id,'INACTIVE',actor);
assert.equal(inactive.status,'INACTIVE');
assert.equal(inactive.version,3);
const active = await transitionSupplierNetworkCapability(org.chat_id,created.id,'ACTIVE',actor);
assert.equal(active.status,'ACTIVE');
assert.equal(active.version,4);

await assert.rejects(() => upsertSupplierNetworkCapability(org.chat_id,{code:'other',name:'Other',source:'VERIFIED'},actor), /verification authority/i);
await assert.rejects(() => upsertSupplierNetworkCapability(org.chat_id,{code:'bad',name:'Bad',visibility:'INVALID'},actor), /visibility/i);
await assert.rejects(() => upsertSupplierNetworkCapability(org.chat_id,{code:'bad',name:'Bad',metadata:[]},actor), /metadata/i);

const otherUser = await getOrCreateUserByTelegram('p182n_' + x, 'Not Supplier');
const otherTenant = await createTenantForUser({userId:otherUser.id,sellerName:'P18.2 Non Supplier '+x,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const other = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(otherTenant.chatId);
const otherActor = {userId:otherUser.id,role:'owner',organizationId:other.organization_id,chatId:otherTenant.chatId};
await assert.rejects(() => upsertSupplierNetworkCapability(otherTenant.chatId,{code:'wholesale',name:'No Supplier'},otherActor), /not registered as a procurement supplier/i);

console.log('Phase 18.2 supplier network capability regression: PASS');
