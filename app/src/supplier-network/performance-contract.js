// Phase 18.8 — Supplier Network Performance contract.
// Performance is derived from authoritative procurement/receipt events; this
// domain never rewrites those source records.
export const SUPPLIER_NETWORK_PERFORMANCE_CONTRACT_VERSION='1.0';
export const SUPPLIER_NETWORK_PERFORMANCE_METRICS=Object.freeze(['RFQ_RESPONSE_RATE','FILL_RATE','PO_COMPLETION_RATE','CANCELLATION_RATE','OBSERVED_PURCHASE_ORDERS']);
export const SUPPLIER_NETWORK_PERFORMANCE_VISIBILITIES=Object.freeze(['NETWORK','RELATIONSHIP','PRIVATE']);
export const SUPPLIER_NETWORK_PERFORMANCE_SOURCES=Object.freeze(['PROCUREMENT_RFQ','PROCUREMENT_PURCHASE_ORDER','PROCUREMENT_RECEIPT']);
export const SUPPLIER_NETWORK_PERFORMANCE_EVENTS=Object.freeze(['supplier.network.performance.observed','supplier.network.performance.recalculated']);
export const SUPPLIER_NETWORK_PERFORMANCE=Object.freeze({capability:'supplier-network.performance',authority:'supplier_network',resource:'supplier_network_performance_observation',identityAuthority:'organizations',sourceAuthorities:Object.freeze({rfq:'procurement',purchaseOrder:'b2b purchase order',receipt:'inventory/procurement receiving'}),derivedOnly:true,sourceMutation:false,procurementMutation:false,inventoryMutation:false,paymentMutation:false,marketplaceSellerAuthority:false});
export function supplierNetworkPerformanceContract(){return Object.freeze({version:SUPPLIER_NETWORK_PERFORMANCE_CONTRACT_VERSION,metrics:[...SUPPLIER_NETWORK_PERFORMANCE_METRICS],visibilities:[...SUPPLIER_NETWORK_PERFORMANCE_VISIBILITIES],sources:[...SUPPLIER_NETWORK_PERFORMANCE_SOURCES],events:[...SUPPLIER_NETWORK_PERFORMANCE_EVENTS],capability:SUPPLIER_NETWORK_PERFORMANCE,principle:'derived observations only; authoritative source records remain immutable'});}
