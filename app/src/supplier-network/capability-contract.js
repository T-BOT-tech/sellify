// Phase 18.2 — Supplier Network Capability contract.
// Organization remains canonical identity. Capabilities are machine-readable
// declarations of what an active supplier can supply or perform.
export const SUPPLIER_NETWORK_CAPABILITY_CONTRACT_VERSION = '1.0';
export const SUPPLIER_NETWORK_CAPABILITY_STATUSES = Object.freeze(['ACTIVE','INACTIVE']);
export const SUPPLIER_NETWORK_CAPABILITY_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
export const SUPPLIER_NETWORK_CAPABILITY_SOURCES = Object.freeze(['DECLARED','VERIFIED']);
export const SUPPLIER_NETWORK_CAPABILITY_TRANSITIONS = Object.freeze({
  ACTIVE: Object.freeze(['INACTIVE']),
  INACTIVE: Object.freeze(['ACTIVE']),
});
export const SUPPLIER_NETWORK_CAPABILITY = Object.freeze({
  capability: 'supplier-network.capability',
  authority: 'supplier_network',
  resource: 'supplier_network_capability',
  actions: Object.freeze(['view','manage','activate','deactivate']),
  identityAuthority: 'organizations',
  supplierParticipationPrerequisite: true,
  productAuthority: 'existing product/catalog authority',
});
export const SUPPLIER_NETWORK_CAPABILITY_EVENTS = Object.freeze([
  'supplier.network.capability.created',
  'supplier.network.capability.updated',
  'supplier.network.capability.activated',
  'supplier.network.capability.deactivated',
]);
export function canTransitionSupplierNetworkCapability(from,to){return Boolean(SUPPLIER_NETWORK_CAPABILITY_TRANSITIONS[String(from||'').toUpperCase()]?.includes(String(to||'').toUpperCase()));}
export function supplierNetworkCapabilityContract(){return Object.freeze({version:SUPPLIER_NETWORK_CAPABILITY_CONTRACT_VERSION,identityAuthority:'organizations',supplierParticipationAuthority:'procurement',statuses:[...SUPPLIER_NETWORK_CAPABILITY_STATUSES],visibilities:[...SUPPLIER_NETWORK_CAPABILITY_VISIBILITIES],sources:[...SUPPLIER_NETWORK_CAPABILITY_SOURCES],transitions:Object.fromEntries(Object.entries(SUPPLIER_NETWORK_CAPABILITY_TRANSITIONS).map(([k,v])=>[k,[...v]])),events:[...SUPPLIER_NETWORK_CAPABILITY_EVENTS],capability:SUPPLIER_NETWORK_CAPABILITY,productAuthority:'existing product/catalog authority',procurementMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});}
