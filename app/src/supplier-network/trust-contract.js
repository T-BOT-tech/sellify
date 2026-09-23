// Phase 18.9 — Supplier Network Trust & Reputation Evidence contract.
// This is explainable evidence, not an opaque composite score.
export const SUPPLIER_NETWORK_TRUST_CONTRACT_VERSION='1.0';
export const SUPPLIER_NETWORK_TRUST_EVIDENCE_TYPES=Object.freeze(['SUPPLIER_PARTICIPATION','QUALIFICATION_VERIFIED','PERFORMANCE_OBSERVED','PROCUREMENT_RELATIONSHIP']);
export const SUPPLIER_NETWORK_TRUST_STATES=Object.freeze(['OBSERVED','VERIFIED']);
export const SUPPLIER_NETWORK_TRUST_VISIBILITIES=Object.freeze(['NETWORK','RELATIONSHIP','PRIVATE']);
export const SUPPLIER_NETWORK_TRUST_EVENTS=Object.freeze(['supplier.network.trust.evidence_observed','supplier.network.trust.refreshed']);
export const SUPPLIER_NETWORK_TRUST=Object.freeze({capability:'supplier-network.trust',authority:'supplier_network',resource:'supplier_network_trust_evidence',identityAuthority:'organizations',sourceAuthorities:Object.freeze({participation:'procurement',qualification:'supplier_network',performance:'supplier_network',relationship:'procurement'}),explainable:true,compositeScore:false,sourceMutation:false,procurementMutation:false,productMutation:false,paymentMutation:false,inventoryMutation:false,marketplaceSellerAuthority:false});
export function supplierNetworkTrustContract(){return Object.freeze({version:SUPPLIER_NETWORK_TRUST_CONTRACT_VERSION,evidenceTypes:[...SUPPLIER_NETWORK_TRUST_EVIDENCE_TYPES],states:[...SUPPLIER_NETWORK_TRUST_STATES],visibilities:[...SUPPLIER_NETWORK_TRUST_VISIBILITIES],events:[...SUPPLIER_NETWORK_TRUST_EVENTS],capability:SUPPLIER_NETWORK_TRUST,principle:'explainable evidence only; no opaque supplier score'});}
