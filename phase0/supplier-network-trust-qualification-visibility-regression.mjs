import assert from 'node:assert/strict';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  setProcurementSupplierParticipation,
  createProcurementSupplierRelationship,
  transitionProcurementSupplierRelationship,
  upsertSupplierNetworkQualification,
  transitionSupplierNetworkQualification,
  refreshSupplierNetworkTrustEvidence,
  listSupplierNetworkTrustEvidence,
  getSupplierNetworkTrustEvidence,
  getSupplierNetworkQualification,
} from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const stamp = String(Date.now());

async function tenant(prefix, name) {
  const user = await getOrCreateUserByTelegram('trust-visibility-' + prefix + '-' + stamp, name);
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
    user,
    chatId: row.chat_id,
    organizationId: row.organization_id,
    actor: { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id },
  };
}

const buyer = await tenant('buyer', 'Trust Visibility Buyer');
const outsider = await tenant('outsider', 'Trust Visibility Outsider');
const supplier = await tenant('supplier', 'Trust Visibility Supplier');
await setProcurementSupplierParticipation(supplier.chatId, {
  status: 'ACTIVE',
  discoverable: true,
}, supplier.actor);

const relationship = await createProcurementSupplierRelationship(buyer.chatId, {
  supplierOrganizationId: supplier.organizationId,
  source: 'DIRECT',
}, buyer.actor);
await transitionProcurementSupplierRelationship(buyer.chatId, relationship.id, 'ACTIVE', buyer.actor);

const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const sourceQualifications = [];
for (const visibility of ['PUBLIC', 'NETWORK', 'RELATIONSHIP', 'PRIVATE', 'CONFIDENTIAL']) {
  let qualification = await upsertSupplierNetworkQualification(supplier.chatId, {
    qualificationType: 'BUSINESS_LICENSE',
    title: visibility + ' business license',
    issuer: visibility + ' issuer',
    referenceNumber: visibility + '-' + stamp,
    evidence: { documentRef: visibility.toLowerCase() + '-document-' + stamp },
    validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validUntil,
    visibility,
  }, supplier.actor);
  qualification = await transitionSupplierNetworkQualification(supplier.chatId, qualification.id, 'DOCUMENTED', supplier.actor);
  qualification = await transitionSupplierNetworkQualification(supplier.chatId, qualification.id, 'VERIFIED', supplier.actor);
  sourceQualifications.push(qualification);
}

const buyerEvidence = await refreshSupplierNetworkTrustEvidence(
  buyer.chatId,
  supplier.organizationId,
  {},
  buyer.actor,
);
const buyerQualificationEvidence = buyerEvidence.filter(item => item.evidenceType === 'QUALIFICATION_VERIFIED');
const buyerVisibleIds = new Set(buyerQualificationEvidence.map(item => item.sourceEntityId));
const byVisibility = Object.fromEntries(sourceQualifications.map(item => [item.title.split(' ')[0], item]));

assert.equal(buyerVisibleIds.has(byVisibility.PUBLIC.id), true, 'PUBLIC qualification may be represented in the network trust view');
assert.equal(buyerVisibleIds.has(byVisibility.NETWORK.id), true, 'NETWORK qualification remains network-visible');
assert.equal(buyerVisibleIds.has(byVisibility.RELATIONSHIP.id), true, 'RELATIONSHIP qualification is visible to an active relationship');
assert.equal(buyerVisibleIds.has(byVisibility.PRIVATE.id), false, 'PRIVATE qualification must not be promoted into network trust evidence');
assert.equal(buyerVisibleIds.has(byVisibility.CONFIDENTIAL.id), false, 'CONFIDENTIAL qualification must not be promoted into network trust evidence');

const stored = db.prepare('SELECT source_entity_id, visibility FROM supplier_network_trust_evidence WHERE supplier_organization_id=? AND evidence_type=?').all(supplier.organizationId, 'QUALIFICATION_VERIFIED');
assert.equal(stored.length, 3, 'only source qualifications with shareable visibility are projected');
const storedVisibility = new Map(stored.map(row => [row.source_entity_id, row.visibility]));
assert.equal(storedVisibility.get(byVisibility.PUBLIC.id), 'NETWORK', 'PUBLIC is narrowed to the trust API network visibility');
assert.equal(storedVisibility.get(byVisibility.NETWORK.id), 'NETWORK');
assert.equal(storedVisibility.get(byVisibility.RELATIONSHIP.id), 'RELATIONSHIP');

const publicEvidence = buyerQualificationEvidence.find(item => item.sourceEntityId === byVisibility.PUBLIC.id);
assert.ok(publicEvidence);

// Source visibility may be tightened after immutable trust evidence was created.
// External reads must re-check the authoritative qualification visibility.
await upsertSupplierNetworkQualification(supplier.chatId, {
  id: byVisibility.PUBLIC.id,
  qualificationType: byVisibility.PUBLIC.qualificationType,
  title: byVisibility.PUBLIC.title,
  issuer: byVisibility.PUBLIC.issuer,
  referenceNumber: byVisibility.PUBLIC.referenceNumber,
  evidence: byVisibility.PUBLIC.evidence,
  validFrom: byVisibility.PUBLIC.validFrom,
  validUntil: byVisibility.PUBLIC.validUntil,
  visibility: 'PRIVATE',
}, supplier.actor);

const afterPrivacyChange = await listSupplierNetworkTrustEvidence(
  buyer.chatId,
  { supplierOrganizationId: supplier.organizationId },
  buyer.actor,
);
assert.equal(afterPrivacyChange.some(item => item.sourceEntityId === byVisibility.PUBLIC.id), false,
  'an immutable network trust row must not bypass a later source-qualification privacy restriction');
assert.equal(await getSupplierNetworkTrustEvidence(buyer.chatId, publicEvidence.id, buyer.actor), null,
  'single-item trust reads must enforce current source qualification visibility too');

// A source visibility increase must not widen an older immutable RELATIONSHIP trust row.
await upsertSupplierNetworkQualification(supplier.chatId, {
  id: byVisibility.RELATIONSHIP.id,
  qualificationType: byVisibility.RELATIONSHIP.qualificationType,
  title: byVisibility.RELATIONSHIP.title,
  issuer: byVisibility.RELATIONSHIP.issuer,
  referenceNumber: byVisibility.RELATIONSHIP.referenceNumber,
  evidence: byVisibility.RELATIONSHIP.evidence,
  validFrom: byVisibility.RELATIONSHIP.validFrom,
  validUntil: byVisibility.RELATIONSHIP.validUntil,
  visibility: 'NETWORK',
}, supplier.actor);
assert.equal(await getSupplierNetworkTrustEvidence(outsider.chatId,
  buyerQualificationEvidence.find(item => item.sourceEntityId === byVisibility.RELATIONSHIP.id).id,
  outsider.actor), null,
  'a later source visibility increase must not widen an immutable RELATIONSHIP trust row for unrelated buyers');

// Revoked qualifications must not continue to appear as current VERIFIED trust evidence.
await transitionSupplierNetworkQualification(supplier.chatId, byVisibility.NETWORK.id, 'REVOKED', supplier.actor);
const afterRevocation = await listSupplierNetworkTrustEvidence(
  buyer.chatId,
  { supplierOrganizationId: supplier.organizationId },
  buyer.actor,
);
assert.equal(afterRevocation.some(item => item.sourceEntityId === byVisibility.NETWORK.id), false,
  'revoked source qualifications must no longer appear as current verified trust evidence');

const ownPrivateQualification = await getSupplierNetworkQualification(supplier.chatId, byVisibility.PRIVATE.id);
assert.equal(ownPrivateQualification.visibility, 'PRIVATE',
  'the supplier organization retains access to its own private source qualification');

console.log('Supplier Network trust qualification visibility regression: PASS');
console.log('Private/confidential qualification evidence is not promoted to network trust visibility');
console.log('Current source visibility and verification status are re-checked for external trust reads');
