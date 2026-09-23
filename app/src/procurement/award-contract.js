// Phase 17.5 — explicit procurement award contract. Award is the procurement
// decision authority and the hand-off boundary to later execution bridges.
export const PROCUREMENT_AWARD_CONTRACT_VERSION='1.0';
export const PROCUREMENT_AWARD_STATES=Object.freeze({DRAFT:['CONFIRMED','CANCELLED'],CONFIRMED:[],CANCELLED:[]});
export const PROCUREMENT_AWARD_CAPABILITY=Object.freeze({capability:'procurement.award',authority:'procurement',resource:'procurement_award',actions:['view','create','confirm','cancel'],splitAwards:true,inventoryMutation:false,paymentMutation:false,b2bQuoteMutation:false,b2bPurchaseOrderMutation:false,commerceOrderMutation:false});
export function canTransitionProcurementAward(from,to){return Boolean(PROCUREMENT_AWARD_STATES[String(from||'').toUpperCase()]?.includes(String(to||'').toUpperCase()));}
export function procurementAwardContract(){return Object.freeze({version:PROCUREMENT_AWARD_CONTRACT_VERSION,states:PROCUREMENT_AWARD_STATES,capability:PROCUREMENT_AWARD_CAPABILITY,decisionAuthority:'procurement',executionBridge:'b2b_purchase_order_authority',b2bPurchaseOrderDistinct:true,inventoryMutation:false,paymentMutation:false,settlementMutation:false,aiRequired:false});}
