import assert from 'node:assert/strict';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  setProcurementSupplierParticipation,
  getSupplierNetworkProfile,
  upsertSupplierNetworkProfile,
  transitionSupplierNetworkProfile,
} from '../backend/lib/store-sqlite.js';
import { supplierNetworkProfileContract, canTransitionSupplierNetworkProfile } from '../app/src/supplier-network/profile-contract.js';

const contract = supplierNetworkProfileContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.identityAuthority, 'organizations');
assert.equal(contract.supplierParticipationAuthority, 'procurement');
assert.equal(contract.capability.capability, 'supplier-network.profile');
assert.equal(contract.procurementMutation, false);
assert.equal(contract.paymentMutation, false);
assert.equal(canTransitionSupplierNetworkProfile('DRAFT', 'PUBLISHED'), true);
assert.equal(canTransitionSupplierNetworkProfile('PUBLISHED', 'DRAFT'), true);
assert.equal(canTransitionSupplierNetworkProfile('PUBLISHED', 'PUBLISHED'), false);

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram('p181_' + x, 'Supplier Profile');
const tenant = await createTenantForUser({userId:user.id,sellerName:'P18.1 Supplier '+x,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const org = db.prepare('SELECT chat_id,organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId);
const actor = {userId:user.id,role:'owner',organizationId:org.organization_id,chatId:org.chat_id};

assert.equal(await getSupplierNetworkProfile(org.chat_id), null);
await setProcurementSupplierParticipation(org.chat_id,{status:'ACTIVE',discoverable:false},actor);
const draft = await upsertSupplierNetworkProfile(org.chat_id,{displayName:'Kaffa Supply Network',description:'Supplier profile',businessCategories:['Coffee','Fertilizer','Coffee'],serviceSummary:'Wholesale supply',visibility:'NETWORK'},actor);
assert.equal(draft.status,'DRAFT');
assert.deepEqual(draft.businessCategories,['Coffee','Fertilizer']);
assert.equal(draft.visibility,'NETWORK');
assert.equal(draft.organizationId,org.organization_id);

const published = await transitionSupplierNetworkProfile(org.chat_id,'PUBLISHED',actor);
assert.equal(published.status,'PUBLISHED');
assert.ok(published.publishedAt);
const updated = await upsertSupplierNetworkProfile(org.chat_id,{displayName:'Kaffa Supply Network Updated',description:'Updated',businessCategories:['Coffee'],serviceSummary:'Regional wholesale',visibility:'PUBLIC',status:'PUBLISHED'},actor);
assert.equal(updated.status,'PUBLISHED');
assert.equal(updated.displayName,'Kaffa Supply Network Updated');
assert.equal(updated.version, published.version + 1);
const suspended = await transitionSupplierNetworkProfile(org.chat_id,'SUSPENDED',actor);
assert.equal(suspended.status,'SUSPENDED');
assert.ok(suspended.suspendedAt);
const redrafted = await transitionSupplierNetworkProfile(org.chat_id,'DRAFT',actor);
assert.equal(redrafted.status,'DRAFT');

// A non-supplier organization cannot create a Supplier Network Profile.
const otherUser = await getOrCreateUserByTelegram('p181n_' + x, 'Not Supplier');
const otherTenant = await createTenantForUser({userId:otherUser.id,sellerName:'P18.1 Non Supplier '+x,businessType:'retail',country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa'});
const other = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(otherTenant.chatId);
const otherActor = {userId:otherUser.id,role:'owner',organizationId:other.organization_id,chatId:otherTenant.chatId};
await assert.rejects(() => upsertSupplierNetworkProfile(otherTenant.chatId,{displayName:'No Supplier'},otherActor), /not registered as a procurement supplier/i);

console.log('Phase 18.1 supplier network profile regression: PASS');
