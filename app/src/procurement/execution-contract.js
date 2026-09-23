// Phase 17.6 — Procurement → existing B2B Purchase Order execution contract.
// This is a boundary declaration only; execution remains in the existing
// backend B2B Purchase Order authority.
export const PROCUREMENT_EXECUTION_CONTRACT_VERSION = '1.0';
export const PROCUREMENT_EXECUTION_CONTRACT = Object.freeze({
  version: PROCUREMENT_EXECUTION_CONTRACT_VERSION,
  source: 'procurement.award',
  target: 'b2b.purchase-order',
  executionAuthority: 'existing_b2b_purchase_order_authority',
  operation: 'createPurchaseOrderFromProcurementAward',
  prerequisites: Object.freeze(['award_confirmed','single_supplier_per_po','catalog_product_present','positive_integer_quantity','buyer_authorized']),
  splitAwardPolicy: 'one_purchase_order_per_supplier',
  sourceType: 'PROCUREMENT_AWARD',
  createsNewPoAuthority: false,
  createsQuote: false,
  mutatesInventory: false,
  mutatesPayments: false,
  mutatesSettlement: false,
  mutatesCommerceOrder: false,
});
export function procurementExecutionContract(){ return PROCUREMENT_EXECUTION_CONTRACT; }
