// Phase 17.7 — Procurement Receiving Contract.
// Procurement owns receipt records; Inventory remains the physical stock
// mutation and ledger authority.
export const PROCUREMENT_RECEIVING_CONTRACT_VERSION='1.0';
export const PROCUREMENT_RECEIVING_CONTRACT=Object.freeze({
  version:PROCUREMENT_RECEIVING_CONTRACT_VERSION,
  source:'b2b.purchase-order',
  target:'inventory',
  operation:'createProcurementReceipt',
  prerequisites:Object.freeze(['po_approved','buyer_authorized','active_receiving_location','catalog_product_present','positive_integer_quantity','no_over_receipt']),
  receiptState:'PENDING → POSTED',
  supportsPartialReceipts:true,
  inventoryMovementType:'PURCHASE',
  inventoryMutationAuthority:'app/src/warehouse/inventory.js#applyStockChange',
  inventoryLedgerAuthority:'app/src/warehouse/ledger.js#recordInventoryMovement',
  createsNewInventoryAuthority:false,
  createsPayment:false,
  createsSettlement:false,
  createsCommerceOrder:false,
});
export function procurementReceivingContract(){return PROCUREMENT_RECEIVING_CONTRACT;}
