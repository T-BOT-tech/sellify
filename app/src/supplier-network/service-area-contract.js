// Phase 18.4 — Supplier Network Service Area contract.
export const SUPPLIER_NETWORK_SERVICE_AREA_CONTRACT_VERSION='1.0';
export const SUPPLIER_NETWORK_SERVICE_AREA_TYPES=Object.freeze(['COUNTRY','REGION','ZONE','DISTRICT','CITY','POSTAL_CODE','RADIUS']);
export const SUPPLIER_NETWORK_SERVICE_AREA_VISIBILITIES=Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
export const SUPPLIER_NETWORK_SERVICE_AREA_STATUSES=Object.freeze(['ACTIVE','INACTIVE']);
export const SUPPLIER_NETWORK_SERVICE_AREA=Object.freeze({capability:'supplier-network.service-area',authority:'supplier_network',resource:'supplier_network_service_area',identityAuthority:'organizations',geographyAuthority:'country/domain pack or normalized geography provider',supplierParticipationPrerequisite:true,procurementMutation:false,productMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});
export const SUPPLIER_NETWORK_SERVICE_AREA_EVENTS=Object.freeze(['supplier.network.service_area.created','supplier.network.service_area.updated','supplier.network.service_area.activated','supplier.network.service_area.deactivated']);
export function supplierNetworkServiceAreaContract(){return Object.freeze({version:SUPPLIER_NETWORK_SERVICE_AREA_CONTRACT_VERSION,capability:SUPPLIER_NETWORK_SERVICE_AREA,types:[...SUPPLIER_NETWORK_SERVICE_AREA_TYPES],visibilities:[...SUPPLIER_NETWORK_SERVICE_AREA_VISIBILITIES],statuses:[...SUPPLIER_NETWORK_SERVICE_AREA_STATUSES],events:[...SUPPLIER_NETWORK_SERVICE_AREA_EVENTS]});}
