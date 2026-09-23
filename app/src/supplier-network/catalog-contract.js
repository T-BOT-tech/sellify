export const SUPPLIER_NETWORK_CATALOG_CONTRACT_VERSION='1.0';
export const SUPPLIER_NETWORK_CATALOG_STATUSES=Object.freeze(['ACTIVE','INACTIVE']);
export const SUPPLIER_NETWORK_CATALOG_VISIBILITIES=Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
export const SUPPLIER_NETWORK_CATALOG_AVAILABILITY=Object.freeze(['AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST']);
export const SUPPLIER_NETWORK_CATALOG=Object.freeze({capability:'supplier-network.catalog',authority:'supplier_network',resource:'supplier_network_catalog_listing',identityAuthority:'organizations',productAuthority:'existing product/catalog authority',supplierParticipationPrerequisite:true,procurementMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});
export const SUPPLIER_NETWORK_CATALOG_EVENTS=Object.freeze(['supplier.network.catalog.listing_created','supplier.network.catalog.listing_updated','supplier.network.catalog.active','supplier.network.catalog.inactive']);
export function supplierNetworkCatalogContract(){return Object.freeze({version:SUPPLIER_NETWORK_CATALOG_CONTRACT_VERSION,capability:SUPPLIER_NETWORK_CATALOG,statuses:[...SUPPLIER_NETWORK_CATALOG_STATUSES],visibilities:[...SUPPLIER_NETWORK_CATALOG_VISIBILITIES],availability:[...SUPPLIER_NETWORK_CATALOG_AVAILABILITY],events:[...SUPPLIER_NETWORK_CATALOG_EVENTS]});}
