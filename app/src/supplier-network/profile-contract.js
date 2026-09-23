// Phase 18.1 — Supplier Network Profile contract.
// Organization remains the canonical identity. This contract describes the
// richer network-facing profile layer and does not create a second supplier
// identity authority.
export const SUPPLIER_NETWORK_PROFILE_CONTRACT_VERSION = '1.0';
export const SUPPLIER_NETWORK_PROFILE_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
export const SUPPLIER_NETWORK_PROFILE_STATES = Object.freeze({
  DRAFT: Object.freeze(['PUBLISHED','SUSPENDED']),
  PUBLISHED: Object.freeze(['DRAFT','SUSPENDED']),
  SUSPENDED: Object.freeze(['DRAFT','PUBLISHED']),
});
export const SUPPLIER_NETWORK_PROFILE_CAPABILITY = Object.freeze({
  capability: 'supplier-network.profile',
  authority: 'supplier_network',
  resource: 'supplier_network_profile',
  actions: Object.freeze(['view','manage','publish','suspend']),
  identityAuthority: 'organizations',
  supplierParticipationPrerequisite: true,
});
export const SUPPLIER_NETWORK_PROFILE_EVENTS = Object.freeze([
  'supplier.network.profile.created',
  'supplier.network.profile.updated',
  'supplier.network.profile.published',
  'supplier.network.profile.suspended',
]);
export function canTransitionSupplierNetworkProfile(from,to){return Boolean(SUPPLIER_NETWORK_PROFILE_STATES[String(from||'').toUpperCase()]?.includes(String(to||'').toUpperCase()));}
export function supplierNetworkProfileContract(){return Object.freeze({version:SUPPLIER_NETWORK_PROFILE_CONTRACT_VERSION,identityAuthority:'organizations',supplierParticipationAuthority:'procurement',visibility:[...SUPPLIER_NETWORK_PROFILE_VISIBILITIES],states:Object.fromEntries(Object.entries(SUPPLIER_NETWORK_PROFILE_STATES).map(([k,v])=>[k,[...v]])),events:[...SUPPLIER_NETWORK_PROFILE_EVENTS],capability:SUPPLIER_NETWORK_PROFILE_CAPABILITY,persistence:'backend domain authority',productAuthority:'existing product/catalog authority',procurementMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});}
