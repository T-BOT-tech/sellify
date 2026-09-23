// Phase 18.5 — Supplier Network Capacity & Availability contract.
export const SUPPLIER_NETWORK_CAPACITY_CONTRACT_VERSION='1.0';
export const SUPPLIER_NETWORK_CAPACITY_SUBJECT_TYPES=Object.freeze(['PRODUCT','CAPABILITY']);
export const SUPPLIER_NETWORK_CAPACITY_AVAILABILITY=Object.freeze(['AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST']);
export const SUPPLIER_NETWORK_CAPACITY_VISIBILITIES=Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
export const SUPPLIER_NETWORK_CAPACITY_STATUSES=Object.freeze(['ACTIVE','INACTIVE']);
export const SUPPLIER_NETWORK_CAPACITY=Object.freeze({capability:'supplier-network.capacity',authority:'supplier_network',resource:'supplier_network_capacity_signal',identityAuthority:'organizations',subjectAuthorities:{PRODUCT:'existing product/catalog authority',CAPABILITY:'supplier-network.capability'},source:'DECLARED_ONLY',observedPerformanceAuthority:'supplier-network.performance (future)',supplierParticipationPrerequisite:true,procurementMutation:false,productMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});
export const SUPPLIER_NETWORK_CAPACITY_EVENTS=Object.freeze(['supplier.network.capacity.declared','supplier.network.capacity.updated','supplier.network.capacity.activated','supplier.network.capacity.deactivated']);
export function supplierNetworkCapacityContract(){return Object.freeze({version:SUPPLIER_NETWORK_CAPACITY_CONTRACT_VERSION,capability:SUPPLIER_NETWORK_CAPACITY,subjectTypes:[...SUPPLIER_NETWORK_CAPACITY_SUBJECT_TYPES],availability:[...SUPPLIER_NETWORK_CAPACITY_AVAILABILITY],visibilities:[...SUPPLIER_NETWORK_CAPACITY_VISIBILITIES],statuses:[...SUPPLIER_NETWORK_CAPACITY_STATUSES],events:[...SUPPLIER_NETWORK_CAPACITY_EVENTS]});}
